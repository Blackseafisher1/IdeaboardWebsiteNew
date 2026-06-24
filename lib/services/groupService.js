/**
 * @fileoverview Gruppen-Service: Erstellung, Mitgliedschaft, Nachrichten und Metadaten für Gruppen.
 * @module lib/services/groupService
 */
const db = require('../../config/db.js');

/**
 * Erstellt eine neue Gruppe (mit optionaler Projektverknüpfung).
 * @async
 * @param {Object} options - Options-Objekt: `{ name, ownerUserId, projectId = null, isPrivate = true }`.
 * @param {Object|null} [connParam=null] - Optionale DB-Verbindung (für Transaktionen).
 * @returns {Promise<number>} ID der erstellten Gruppe.
 */
async function createGroup({ name, ownerUserId, projectId = null, isPrivate = true }, connParam = null) {
    // Wenn eine Verbindung übergeben wurde, verwende sie (Aufrufer verwaltet die Transaktion); sonst erstelle eine neue Verbindung
    const usingExternalConn = !!connParam;
    const conn = connParam || (await db.getConnection());
    try {
        if (!usingExternalConn) await conn.beginTransaction();

        const resIns = await conn.query('INSERT INTO group_chats (name, owner_user_id, project_id, is_private) VALUES (?, ?, ?, ?)', [name, ownerUserId, projectId, isPrivate ? 1 : 0]);
        const groupId = resIns.insertId;

        // Füge den Ersteller als Owner-Mitglied hinzu
        await conn.query('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, ownerUserId, 'owner']);

        if (!usingExternalConn) await conn.commit();
        return groupId;
    } catch (e) {
        if (!usingExternalConn) await conn.rollback();
        throw e;
    } finally {
        if (!usingExternalConn) conn.release();
    }
}

/**
 * Liefert Gruppen-Metadaten nach Gruppen-ID.
 * @async
 * @param {number} groupId
 * @returns {Promise<Object|undefined>}
 */
async function getGroupById(groupId) {
    const rows = await db.query(
        'SELECT * FROM group_chats WHERE id = ?',
        [groupId]);
    return rows[0];
}

/**
 * Liefert die Gruppen-ID, die mit einem Projekt verknüpft ist.
 * @async
 * @param {number} projectId
 * @returns {Promise<number|undefined>}
 */
async function getGroupIdByProjectId(projectId) {
    const rows = await db.query(
        'SELECT id FROM group_chats WHERE project_id = ?',
        [projectId]);
    return rows[0]?.id;
}

/**
 * Listet Gruppen eines Benutzers mit letzter Nachricht und Aktivitätszeit.
 * @async
 * @param {number} userId
 * @returns {Promise<Array<Object>>}
 */
async function listUserGroups(userId) {
    return await db.query(`
        SELECT g.*, m.role,
               (SELECT message FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_activity
        FROM group_chats g
        JOIN group_members m ON g.id = m.group_id
        WHERE m.user_id = ?
        ORDER BY last_activity DESC, g.created_at DESC
    `, [userId]);
}

/**
 * Fügt ein Mitglied zur Gruppe hinzu (optional innerhalb einer Transaktion).
 * @async
 * @param {number} groupId
 * @param {number} userId
 * @param {string} [role='member']
 * @param {Object|null} [connParam=null]
 * @returns {Promise<any>}
 */
async function addMember(groupId, userId, role = 'member', connParam = null) {
    if (connParam) {
        return await connParam.query('INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, role]);
    }
    return await db.query('INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, role]);
}

/**
 * Entfernt ein Mitglied aus der Gruppe.
 * @async
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<any>}
 */
async function removeMember(groupId, userId) {
    return await db.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
}

/**
 * Prüft, ob ein Nutzer Mitglied einer Gruppe ist.
 * @async
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isMember(groupId, userId) {
    const rows = await db.query(
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]);
    return rows.length > 0;
}

/**
 * Liefert die Rolle eines Mitglieds in der Gruppe.
 * @async
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<string|undefined>}
 */
async function getMemberRole(groupId, userId) {
    const rows = await db.query(
        'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]);
    return rows[0]?.role;
}

/**
 * Ermöglicht einem Mitglied das Verlassen einer Gruppe. Überträgt ggf. Eigentum.
 * @async
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<boolean>} `true`, wenn erfolgreich.
 */
async function leaveGroup(groupId, userId) {
    const role = await getMemberRole(groupId, userId);
    if (!role) return false;

    if (role === 'owner') {
        const nextOwnerRows = await db.query(`
            SELECT user_id FROM group_members 
            WHERE group_id = ? AND user_id != ? 
            ORDER BY FIELD(role, 'admin', 'member'), joined_at ASC 
            LIMIT 1
        `, [groupId, userId]);
        const nextOwner = nextOwnerRows[0];

        if (nextOwner) {
            await db.query(
                'UPDATE group_members SET role = "owner" WHERE group_id = ? AND user_id = ?',
                [groupId, nextOwner.user_id]
            );
            await db.query(
                'UPDATE group_chats SET owner_user_id = ? WHERE id = ?',
                [nextOwner.user_id, groupId]
            );
        } else {
            // Keine anderen Mitglieder übrig – Gruppe ist besitzerlos.
            // Vorerst einfach verlassen lassen.
        }
    }

    const result = await db.query(
        'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
        [groupId, userId]
    );
    return result.affectedRows > 0;
}

/**
 * Liefert Gruppen-Nachrichten nach `afterId`.
 * @async
 * @param {number} groupId
 * @param {number} [afterId=0]
 * @param {number} [limit=1000]
 * @returns {Promise<Array<Object>>}
 */
async function getGroupMessages(groupId, afterId = 0, limit = 1000) {
    const rows = await db.query(`
        SELECT m.id AS message_id, m.group_id AS conversation_id, m.sender_user_id AS sender_id, 
               m.message, m.message_type, m.file_name, m.file_size, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
               u.username AS sender_name 
        FROM group_messages m
        JOIN users u ON u.user_id = m.sender_user_id
        WHERE m.group_id = ? AND m.id > ?
        ORDER BY m.id DESC
        LIMIT ?
    `, [groupId, afterId, limit]);
    return rows.reverse();
}

/**
 * Liefert Gruppen-Nachrichten vor `beforeId`.
 * @async
 * @param {number} groupId
 * @param {number} beforeId
 * @param {number} [limit=20]
 * @returns {Promise<Array<Object>>}
 */
async function getGroupMessagesBefore(groupId, beforeId, limit = 20) {
    const rows = await db.query(`
        SELECT m.id AS message_id, m.group_id AS conversation_id, m.sender_user_id AS sender_id, 
               m.message, m.message_type, m.file_name, m.file_size, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
               u.username AS sender_name 
        FROM group_messages m
        JOIN users u ON u.user_id = m.sender_user_id
        WHERE m.group_id = ? AND m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
    `, [groupId, beforeId, limit]);
    return rows.reverse();
}

/**
 * Liefert die neuesten n Nachrichten einer Gruppe.
 * @async
 * @param {number} groupId
 * @param {number} [limit=20]
 * @returns {Promise<Array<Object>>}
 */
async function fetchLatestGroupMessages(groupId, limit = 20) {
    const rows = await db.query(`
        SELECT m.id AS message_id, m.group_id AS conversation_id, m.sender_user_id AS sender_id, 
               m.message, m.message_type, m.file_name, m.file_size, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
               u.username AS sender_name 
        FROM group_messages m
        JOIN users u ON u.user_id = m.sender_user_id
        WHERE m.group_id = ?
        ORDER BY m.id DESC
        LIMIT ?
    `, [groupId, limit]);
    return rows.reverse();
}

/**
 * Speichert eine Gruppen-Nachricht und aktualisiert die Gruppen-Aktivität.
 * @async
 * @param {number} groupId
 * @param {number} senderId
 * @param {string} text
 * @param {string} [type='text']
 * @param {string|null} [fileName=null]
 * @param {number|null} [fileSize=null]
 * @returns {Promise<Object>} Die gespeicherte Nachricht.
 */
async function saveMessage(groupId, senderId, text, type = 'text', fileName = null, fileSize = null) {
    const res = await db.query(`
        INSERT INTO group_messages (group_id, sender_user_id, message, message_type, file_name, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [groupId, senderId, text, type, fileName, fileSize]);
    
    const messageId = res.insertId;

    // Update group activity
    await db.query('UPDATE group_chats SET updated_at = NOW() WHERE id = ?', [groupId]);

    const messageRows = await db.query(`
        SELECT m.id AS message_id, m.group_id AS conversation_id, m.sender_user_id AS sender_id, 
               m.message, m.message_type, m.file_name, m.file_size, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
               u.username AS sender_name
        FROM group_messages m
        JOIN users u ON u.user_id = m.sender_user_id
        WHERE m.id = ?
    `, [messageId]);
    return messageRows[0];
}

/**
 * Aktualisiert eine Gruppen-Nachricht (setzt `is_edited`).
 * @async
 * @param {number} messageId
 * @param {number} userId
 * @param {string} newText
 * @returns {Promise<boolean>}
 */
async function updateMessage(messageId, userId, newText) {
    const result = await db.query(
        'UPDATE group_messages SET message = ?, is_edited = TRUE, updated_at = NOW() WHERE id = ? AND sender_user_id = ?',
        [newText, messageId, userId]
    );
    return result.affectedRows > 0;
}

/**
 * Markiert eine Gruppen-Nachricht als gelöscht.
 * @async
 * @param {number} messageId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function deleteMessage(messageId, userId) {
    const result = await db.query(
        'UPDATE group_messages SET is_deleted = TRUE, message = "[GELÖSCHT]", updated_at = NOW() WHERE id = ? AND sender_user_id = ?',
        [messageId, userId]
    );
    return result.affectedRows > 0;
}

/**
 * Liefert eine Gruppen-Nachricht nach ID inklusive Sendernamen.
 * @async
 * @param {number} messageId
 * @returns {Promise<Object|undefined>}
 */
async function getMessageById(messageId) {
    const messageRows = await db.query(`
        SELECT m.id AS message_id, m.group_id AS conversation_id, m.sender_user_id AS sender_id, 
               m.message, m.message_type, m.file_name, m.file_size, m.is_edited, m.is_deleted, m.created_at, m.updated_at,
               u.username AS sender_name
        FROM group_messages m
        JOIN users u ON u.user_id = m.sender_user_id
        WHERE m.id = ?
    `, [messageId]);
    return messageRows[0];
}

/**
 * Versucht, den Originaldateinamen aus einer Nachrichten-Referenz zu extrahieren.
 * @async
 * @param {number} groupId
 * @param {string} filename
 * @returns {Promise<string>}
 */
async function getOriginalFilename(groupId, filename) {
    const rows = await db.query(
        "SELECT message FROM group_messages WHERE group_id = ? AND message LIKE ? LIMIT 1",
        [groupId, `%${filename}%`]);
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
 * Liefert Mitglieder einer Gruppe mit Rollen und Beitrittszeit.
 * @async
 * @param {number} groupId
 * @returns {Promise<Array<Object>>}
 */
async function getGroupMembers(groupId) {
    return await db.query(`
        SELECT m.user_id, m.role, m.joined_at, u.username
        FROM group_members m
        JOIN users u ON u.user_id = m.user_id
        WHERE m.group_id = ?
        ORDER BY FIELD(m.role, 'owner', 'admin', 'member'), m.joined_at ASC
    `, [groupId]);
}

module.exports = {
    createGroup,
    getGroupById,
    getGroupIdByProjectId,
    listUserGroups,
    addMember,
    removeMember,
    isMember,
    getMemberRole,
    leaveGroup,
    getGroupMessages,
    getGroupMessagesBefore,
    fetchLatestGroupMessages,
    saveMessage,
    updateMessage,
    deleteMessage,
    getMessageById,
    getGroupMembers,
    getOriginalFilename
};


