/**
 * @fileoverview Direktnachrichten-Service: Nachrichten lesen, speichern, Konversationen verwalten.
 * @module lib/services/dmMessagingService
 */
const db = require('../../config/db.js');

/**
 * Holt neue Nachrichten einer Unterhaltung nach einer bestimmten ID.
 * @async
 * @param {number} conversationId
 * @param {number} [afterId]
 * @returns {Promise<Array<Object>>}
 */
async function fetchNewMessages(conversationId, afterId) {
    const rows = await db.query(`
        SELECT m.*, u.username as sender_name
        FROM dm_messages m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.conversation_id = ? AND m.message_id > ?
        ORDER BY m.message_id ASC
    `, [conversationId, afterId || 0]);
    return rows;
}

/**
 * Holt geänderte oder neue Nachrichten (Deltas) nach einem Zeitstempel.
 * @async
 * @param {number} conversationId
 * @param {string} since ISO-Zeitstempel oder MySQL-Format
 * @returns {Promise<Array<Object>>}
 */
/**
 * Holt die neuesten n Nachrichten einer Unterhaltung.
 * @async
 * @param {number} conversationId
 * @param {number} [limit=20]
 * @returns {Promise<Array<Object>>}
 */
async function fetchLatestMessages(conversationId, limit = 20) {
    const rows = await db.query(`
        SELECT m.*, u.username as sender_name
        FROM dm_messages m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.conversation_id = ?
        ORDER BY m.message_id DESC
        LIMIT ?
    `, [conversationId, limit]);
    return rows.reverse();
}

/**
 * Prüft, ob ein Benutzer Zugriff auf eine Unterhaltung hat.
 * @async
 * @param {number} conversationId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function ensureConversationAccess(conversationId, userId) {
    const rows = await db.query(
        'SELECT conversation_id FROM dm_conversations WHERE conversation_id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversationId, userId, userId]
    );
    const row = rows[0];
    return !!row;
}

/**
 * Liefert die Konversationen eines Benutzers mit Metadaten (letzte Nachricht, ungelesen).
 * @async
 * @param {number} userId
 * @returns {Promise<Array<Object>>}
 */
async function getConversations(userId) {
    return await db.query(`
        SELECT 
            c.conversation_id,
            c.updated_at,
            u.user_id as other_user_id,
            u.username as other_username,
            (SELECT message FROM dm_messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT COUNT(*) FROM dm_messages WHERE conversation_id = c.conversation_id AND sender_id != ? AND is_read = FALSE) as unread_count
        FROM dm_conversations c
        JOIN users u ON (u.user_id = c.user1_id OR u.user_id = c.user2_id)
        WHERE (c.user1_id = ? OR c.user2_id = ?) AND u.user_id != ?
        ORDER BY c.updated_at DESC
    `, [userId, userId, userId, userId]);
}

/**
 * Sucht Benutzer für Direktnachrichten (optional alle Ergebnisse zurückgeben).
 * @async
 * @param {number} currentUserId
 * @param {string} query
 * @param {number} [limit=20]
 * @param {boolean} [all=false]
 * @returns {Promise<Array<Object>>}
 */
async function searchUsersForDms(currentUserId, query, limit = 20, all = false) {
    const likeParam = `${query || ''}%`;
    const sql = `
        SELECT
            u.user_id,
            u.username,
            u.email,
            lm.message AS last_message,
            lm.created_at AS last_message_time
        FROM users u
        LEFT JOIN dm_conversations c
            ON ( (c.user1_id = u.user_id OR c.user2_id = u.user_id)
                     AND (c.user1_id = ? OR c.user2_id = ?) )
        LEFT JOIN (
            SELECT m1.conversation_id, m1.message, m1.created_at
            FROM dm_messages m1
            JOIN (
                SELECT conversation_id, MAX(created_at) AS max_created
                FROM dm_messages
                GROUP BY conversation_id
            ) mx ON m1.conversation_id = mx.conversation_id AND m1.created_at = mx.max_created
        ) lm ON lm.conversation_id = c.conversation_id
        WHERE u.username LIKE ?
            AND u.user_id != ?
        ORDER BY
            CASE WHEN lm.created_at IS NULL THEN 1 ELSE 0 END,
            lm.created_at DESC,
            u.username ASC
        ${all ? '' : 'LIMIT ?'}
    `;

    const params = [currentUserId, currentUserId, likeParam, currentUserId];
    if (!all) params.push(limit);

    return await db.query(sql, params);
}

/**
 * Liefert eine bestehende Konversation zwischen zwei Nutzern oder erstellt eine neue.
 * @async
 * @param {number} userId1
 * @param {number} userId2
 * @returns {Promise<Object>} Conversation-Objekt (mit `conversation_id`).
 */
async function getOrCreateConversation(userId1, userId2) {
    const u1 = Number(userId1);
    const u2 = Number(userId2);
    const minId = Math.min(u1, u2);
    const maxId = Math.max(u1, u2);

    const conversationRows = await db.query(`
        SELECT * FROM dm_conversations 
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `, [u1, u2, u2, u1]);
    let conversation = conversationRows[0];

    if (!conversation) {
        const result = await db.query('INSERT INTO dm_conversations (user1_id, user2_id) VALUES (?, ?)', [minId, maxId]);
        conversation = { conversation_id: result.insertId };
    }
    
    return conversation;
}

/**
 * Markiert Nachrichten als gelesen und liefert die zuletzt gelesene ID zurück.
 * @async
 * @param {number} conversationId
 * @param {number} userId
 * @returns {Promise<number|null>} Max gelesenes Message-ID oder `null`.
 */
async function markMessagesAsRead(conversationId, userId) {
    const maxIdRows = await db.query(
        'SELECT MAX(message_id) as maxId FROM dm_messages WHERE conversation_id = ? AND sender_id != ?',
        [conversationId, userId]
    );
    const maxIdRow = maxIdRows[0];
    const maxId = maxIdRow?.maxId;

    await db.query(
        'UPDATE dm_messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE',
        [conversationId, userId]
    );
    
    return maxId ? Number(maxId) : null;
}

/**
 * Liefert Nachrichten einer Konversation mit optionalem Limit.
 * @async
 * @param {number} conversationId
 * @param {number} [limit=1000]
 * @returns {Promise<Array<Object>>}
 */
async function getConversationMessages(conversationId, limit = 1000) {
    const rows = await db.query(`
        SELECT m.*, u.username as sender_name FROM dm_messages m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.conversation_id = ? 
        ORDER BY m.message_id DESC
        LIMIT ?
    `, [conversationId, limit]);
    return rows.reverse();
}

/**
 * Liefert Nachrichten einer Konversation vor `beforeId`.
 * @async
 * @param {number} conversationId
 * @param {number} beforeId
 * @param {number} [limit=20]
 * @returns {Promise<Array<Object>>}
 */
async function getConversationMessagesBefore(conversationId, beforeId, limit = 20) {
    const rows = await db.query(`
        SELECT m.*, u.username as sender_name FROM dm_messages m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.conversation_id = ? AND m.message_id < ?
        ORDER BY m.message_id DESC
        LIMIT ?
    `, [conversationId, beforeId, limit]);
    return rows.reverse();
}

/**
 * Speichert eine neue Nachricht und aktualisiert das `updated_at`-Feld der Konversation.
 * @async
 * @param {number} conversationId
 * @param {number} senderId
 * @param {string} text
 * @returns {Promise<Object>} Gespeicherte Nachricht mit Sendernamen.
 */
async function saveMessage(conversationId, senderId, text) {
    const resIns = await db.query(
        'INSERT INTO dm_messages (conversation_id, sender_id, message) VALUES (?, ?, ?)',
        [conversationId, senderId, text]
    );
    const messageId = resIns.insertId;

    // Aktualisiere den `updated_at`-Zeitstempel der Konversation
    await db.query(
        'UPDATE dm_conversations SET updated_at = NOW() WHERE conversation_id = ?',
        [conversationId]
    );

    const rows = await db.query(`
        SELECT m.*, u.username AS sender_name
        FROM dm_messages m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.message_id = ?
    `, [messageId]);
    return rows[0];
}

/**
 * Versucht den Originaldateinamen einer in einer Nachricht referenzierten Datei zu ermitteln.
 * @async
 * @param {number} conversationId
 * @param {string} filename
 * @returns {Promise<string>} Originaler Dateiname oder übergebenes `filename`.
 */
async function getOriginalFilename(conversationId, filename) {
    const rows = await db.query(
        "SELECT message FROM dm_messages WHERE conversation_id = ? AND message LIKE ? LIMIT 1",
        [conversationId, `%${filename}%`]);
    if (rows.length > 0) {
        const msg = rows[0].message;
        if (msg.startsWith('[FILE]')) {
            const parts = msg.split('|');
            if (parts.length > 1) {
                return parts[1].trim();
            }
        }
    }
    return filename;
}

/**
 * Aktualisiert eine Nachrichttext (versucht `is_edited` Flag zu setzen, fallback wenn Spalte fehlt).
 * @async
 * @param {number} messageId
 * @param {number} userId
 * @param {string} newText
 * @returns {Promise<boolean>} `true`, wenn aktualisiert.
 */
async function updateMessage(messageId, userId, newText) {
    // Versuche Nachricht und Flag zu aktualisieren. Wenn die Flag-Spalte fehlt, auf reine Text-Aktualisierung zurückfallen.
    try {
        const result = await db.query(
            'UPDATE dm_messages SET message = ?, is_edited = TRUE, updated_at = NOW() WHERE message_id = ? AND sender_id = ?',
            [newText, messageId, userId]
        );
        return result.affectedRows > 0;
    } catch (e) {
        if (e.message && (e.message.includes('Unknown column') || e.errno === 1054)) {
            const result = await db.query(
                'UPDATE dm_messages SET message = ?, updated_at = NOW() WHERE message_id = ? AND sender_id = ?',
                [newText, messageId, userId]
            );
            return result.affectedRows > 0;
        }
        throw e;
    }
}

/**
 * Löscht/markiert eine Nachricht als gelöscht (setzt `is_deleted` und ersetzt Text durch `[GELÖSCHT]`).
 * @async
 * @param {number} messageId
 * @param {number} userId
 * @returns {Promise<boolean>} `true`, wenn gelöscht.
 */
async function deleteMessage(messageId, userId) {
    try {
        const result = await db.query(
            'UPDATE dm_messages SET is_deleted = TRUE, message = "[GELÖSCHT]", updated_at = NOW() WHERE message_id = ? AND sender_id = ?',
            [messageId, userId]
        );
        return result.affectedRows > 0;
    } catch (e) {
        if (e.message && (e.message.includes('Unknown column') || e.errno === 1054)) {
            const result = await db.query(
                'UPDATE dm_messages SET message = "[GELÖSCHT]", updated_at = NOW() WHERE message_id = ? AND sender_id = ?',
                [messageId, userId]
            );
            return result.affectedRows > 0;
        }
        throw e;
    }
}

/**
 * Liefert eine Nachricht nach ID inklusive Sendernamen.
 * @async
 * @param {number} messageId
 * @returns {Promise<Object|undefined>}
 */
async function getMessageById(messageId) {
    const rows = await db.query(`
        SELECT m.*, u.username AS sender_name
        FROM dm_messages m
        JOIN users u ON u.user_id = m.sender_id
        WHERE m.message_id = ?
    `, [messageId]);
    return rows[0];
}

module.exports = {
    fetchNewMessages,
    fetchLatestMessages,
    ensureConversationAccess,
    getConversations,
    searchUsersForDms,
    getOrCreateConversation,
    markMessagesAsRead,
    getConversationMessages,
    getConversationMessagesBefore,
    saveMessage,
    getOriginalFilename,
    updateMessage,
    deleteMessage,
    getMessageById
};


