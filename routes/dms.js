/**
 * @fileoverview Direktnachrichten-Routen (Inbox, Chat, SSE-Updates, Datei-Uploads).
 * Unterstützt SSE für Live-Updates, HTMX-Partial-Rendering und Upload-Quarantäne.
 * @module routes/dms
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { quarantineFile } = require('../lib/upload_quarantine');
const asyncHandler = require('../lib/asyncHandler');
const { errorHtml } = require('../lib/http');

const {
    incrementPresence,
    decrementPresence,
    getPresenceList,
    broadcastPresence,
    notifyDmWaiters,
    waitForDmMessages,
    dmWaiters
} = require('../lib/services/dmPresenceService');

const {
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
} = require('../lib/services/dmMessagingService');

const { dmUpload } = require('../lib/services/dmFilesService');
const userService = require('../lib/services/userService');
const { isLoggedIn } = require('./middleware');
router.use(isLoggedIn);
const htmxDetector = require('../lib/htmxDetector');
router.use(htmxDetector.middleware);

/**
 * POST /dms/leave
 * Meldet einen Benutzer aus einer Konversation ab (Präsenz dekrementieren).
 * @name POST /leave
 * @function
 * @inner
 */
router.post('/leave', asyncHandler(async (req, res) => {
    const conversationId = Number(req.body && req.body.conversationId);
    const userId = req.session && req.session.user && req.session.user.id;
    if (!conversationId || !userId) return res.status(400).json({ error: 'invalid' });

    try { decrementPresence(conversationId, userId); } catch (e) { console.error('decrementPresence error', e); }
    try { notifyDmWaiters(conversationId); } catch (e) { console.error('notifyDmWaiters error', e); }

    return res.json({ ok: true });
}));

/**
 * Hilfsfunktion zum Rendern von Nachrichten-Partials.
 * @param {Response} res - Express Response Objekt.
 * @param {Array<Object>} messages - Liste der Nachrichten.
 * @param {number} currentUserId - ID des aktuellen Benutzers.
 * @returns {Promise<string>} HTML-Markup der Nachrichten.
 */
function renderMessageItems(res, messages, currentUserId) {
    /**
     * Rendert das Partial `dms/partials/message_items` und liefert das Ergebnis
     * als Promise zurück. Bei Renderfehler wird das Promise abgelehnt.
     * @returns {Promise<string>} Gerendertes HTML
     */
    return new Promise((resolve, reject) => {
        res.render('dms/partials/message_items', { messages, currentUserId, layout: false }, (err, html) => {
            if (err) return reject(err);
            resolve(html);
        });
    });
}

/**
 * GET /dms
 * Hauptansicht der Inbox: Listet alle Konversationen auf.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
    const userId = req.session.user.id;

    // Alle Konversationen für den Benutzer abrufen, inklusive Partner und letzter Nachricht
    const conversations = await getConversations(userId);

    res.render('dms/index', {
        conversations,
        user: req.session.user,
        activePage: 'chat'
    });
}));

/**
 * GET /dms/search
 * Sucht nach Benutzern für neue Direktnachrichten.
 * @name GET /search
 * @function
 * @inner
 */
router.get('/search', asyncHandler(async (req, res) => {
    const rawQuery = (req.query.q || '').trim();
    const currentUserId = req.session.user.id;

    // Verwende einfache Präfix-LIKE-Suche auf `username` (und `name`, falls vorhanden).
    // Standardmäßig 20 Ergebnisse; `?all=1` liefert alle Treffer zur aktuellen Anfrage.
    const all = req.query.all === '1';
    const limit = all ? null : (parseInt(req.query.limit, 10) || 20);

    const users = await searchUsersForDms(currentUserId, rawQuery, limit, all);
    const allLoaded = all ? true : users.length < (limit || 0);

    // Flag für HTMX-Erkennung verwenden
    if (req.isHtmx) {
        return res.render('dms/partials/user_list', { users, allLoaded, searchQuery: rawQuery });
    }

    res.render('dms/search', {
        users,
        searchQuery: rawQuery,
        allLoaded,
        user: req.session.user,
        activePage: 'chat'
    });
}));

/**
 * GET /dms/chat-updates/:conversationId
 * SSE-Endpoint für Echtzeit-Updates in einem DM-Chat.
 * @name GET /chat-updates/:conversationId
 * @function
 * @inner
 */
router.get('/chat-updates/:conversationId', asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const currentUserId = req.session.user.id;
    let afterId = Number(req.query.afterId || 0);

    const allowed = await ensureConversationAccess(conversationId, currentUserId);
    if (!allowed) return res.status(403).json({ error: 'Nicht berechtigt' });

    // SSE-Unterstützung
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('\n'); // Initialer Flush

/**
 * sendUpdate ist ein Express-Route-Handler und verarbeitet Anfragen für diese Route.
 *
 * @returns {*} Beschreibung des Rückgabewerts
 * @function sendUpdate
 */
        const sendUpdate = async (payload = null) => {
            // Wenn dies ein reiner Präsenz-Broadcast ist, sende ein dediziertes Präsenz-Event und brich ab
            if (payload && payload.presence) {
                try {
                    const online = getPresenceList(conversationId);
                    res.write(`event: presence\ndata: ${JSON.stringify({ online })}\n\n`);
                } catch (e) { console.error('Fehler beim Schreiben von Präsenz-SSE:', e); }
                return;
            }

            // Markierungen zum Bearbeiten/Löschen handhaben
            if (payload && (payload.type === 'edit' || payload.type === 'delete')) {
                const message = await getMessageById(payload.messageId);
                if (message) {
                    const html = await renderMessageItems(res, [message], currentUserId);
                    const markerData = { 
                        type: 'update', 
                        messageId: payload.messageId, 
                        html,
                        action: payload.type,
                        updatedAt: message.updated_at
                    };
                    res.write(`event: marker\ndata: ${JSON.stringify(markerData)}\n\n`);
                    return;
                }
            }

            // Hole neue Nachrichten seit afterId
            const messages = await fetchNewMessages(conversationId, afterId);
            let lastReadId = payload ? payload.lastReadId : null;

            if (messages.length > 0) {
                // Wenn mindestens eine neue Nachricht von anderen Nutzern vorliegt,
                // markiere die Konversation als gelesen und benachrichtige Warteprozesse.
                if (messages.some(m => m.sender_id !== currentUserId)) {
                    const maxId = await markMessagesAsRead(conversationId, currentUserId);
                    if (maxId) {
                        lastReadId = maxId;
                        notifyDmWaiters(conversationId, { lastReadId: maxId });
                    }
                }
                const html = await renderMessageItems(res, messages, currentUserId);
                
                // pointer aktualisieren
                afterId = messages[messages.length - 1].message_id;

                // JSON-Stringify mit BigInt-Safe-Callback (BigInt -> String konvertieren)
                const json = JSON.stringify({ html, lastId: afterId, lastReadId }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
                res.write(`data: ${json}\n\n`);
            } else if (lastReadId) {
                // Sende nur das `lastReadId`-Update
                res.write(`data: ${JSON.stringify({ lastReadId }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}\n\n`);
            }

            // Zusätzlich ein Präsenz-Ereignis senden
            try {
                const online = getPresenceList(conversationId);
                res.write(`event: presence\ndata: ${JSON.stringify({ online })}\n\n`);
            } catch (e) { /* Schreibfehler ignorieren */ }
        };

        const waiter = {
            sse: true,
            userId: currentUserId,
            // Trigger-Funktion: löst ein Update aus und protokolliert Fehler
            trigger: (payload) => sendUpdate(payload).catch(err => console.error('SSE trigger error:', err)),
            // Cleanup-Funktion: entfernt diesen Waiter und reduziert Präsenz
            cleanup: () => {
                const set = dmWaiters.get(Number(conversationId));
                if (set) {
                    set.delete(waiter);
                    if (set.size === 0) dmWaiters.delete(Number(conversationId));
                }
                // Präsenz für diesen Benutzer verringern, wenn diese Verbindung beendet wird
                try { decrementPresence(conversationId, currentUserId); } catch (e) {}
            }
        };

        const set = dmWaiters.get(Number(conversationId)) || new Set();
        set.add(waiter);
        dmWaiters.set(Number(conversationId), set);

        // Präsenz für diese verbundene SSE erhöhen
        try { incrementPresence(conversationId, currentUserId); } catch (e) {}

        // Heartbeat: hält die SSE-Verbindung offen (alle 15s einen Kommentar senden)
        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 15000);

        // Wenn die Verbindung geschlossen wird, Heartbeat löschen und Cleanup ausführen
        req.on('close', () => {
            clearInterval(heartbeat);
            waiter.cleanup();
        });

        // Initialen Catch-up senden
        await sendUpdate();
        return;
    }

    // Long-Polling wird nicht mehr unterstützt
    res.status(406).json({ error: 'SSE erforderlich. Long-Polling wird nicht mehr unterstützt.' });
}));

/**
 * GET /dms/chat/:userId
 * Zeigt die Chat-Seite für einen spezifischen Benutzer an.
 * @name GET /chat/:userId
 * @function
 * @inner
 */
router.get('/chat/:userId', asyncHandler(async (req, res) => {
    const currentUserId = req.session.user.id;
    const otherUserId = req.params.userId;
    
    if (currentUserId == otherUserId) return res.redirect('/dms');

    const otherUser = await userService.getUserMinimal(otherUserId);
    if (!otherUser) return res.status(404).send(req.isHtmx ? 'Benutzer nicht gefunden' : errorHtml('Benutzer nicht gefunden'));

    // Konversation finden oder erstellen
    const conversation = await getOrCreateConversation(currentUserId, otherUserId);
    // Initial render fetches up to 20 latest messages
    const messages = await getConversationMessages(conversation.conversation_id, 20);
    
    const unreadMaxId = await markMessagesAsRead(conversation.conversation_id, currentUserId);
    if (unreadMaxId) {
        notifyDmWaiters(conversation.conversation_id, { lastReadId: unreadMaxId });
    }
    const lastMessageId = messages.length ? messages[messages.length - 1].message_id : 0;
    const lastSync = messages.length ? (messages[messages.length-1].updated_at instanceof Date ? messages[messages.length-1].updated_at.toISOString() : messages[messages.length-1].updated_at) : null;

    res.render('dms/chat', {
        messages,
        conversation,
        otherUser,
        currentUserId,
        activePage: 'chat',
        lastMessageId,
        lastSync
    });
}));

/**
 * GET /dms/chat/:conversationId/history
 * Liefert ältere Nachrichten für die Pagination.
 */
router.get('/chat/:conversationId/history', asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const currentUserId = req.session.user.id;
    const beforeId = parseInt(req.query.beforeId, 10);

    if (isNaN(beforeId)) return res.status(400).send(req.isHtmx ? 'Ungültige ID' : errorHtml('Ungültige ID'));
    if (!(await ensureConversationAccess(conversationId, currentUserId))) return res.status(403).send(req.isHtmx ? 'Kein Zugriff' : errorHtml('Kein Zugriff'));
    try {
        const messages = await getConversationMessagesBefore(conversationId, beforeId, 20);
        const html = await renderMessageItems(res, messages, currentUserId);

        if (messages.length === 20) {
            const oldestId = messages[0].message_id;
            res.send(`
                <div class="load-more-wrapper" style="display: flex; justify-content: center; padding: 20px 10px; width: 100%;">
                    <div class="load-more-container btn secondary" 
                         hx-get="/dms/chat/${conversationId}/history?beforeId=${oldestId}" 
                         hx-trigger="load-history, click" 
                         hx-swap="outerHTML"
                         hx-target="closest .load-more-wrapper"
                         style="width: fit-content;">
                        <span class="load-more-text">Ältere Nachrichten laden</span>
                        <div class="loading-spinner" style="display:none">Lade...</div>
                    </div>
                </div>
                ${html}
            `);
        } else {
            res.send(html);
        }
    } catch (err) {
        console.error('Error while loading DM history for conversation', conversationId, 'beforeId', beforeId, err);
        if (req.isHtmx) return res.status(500).send('Fehler beim Laden der Nachrichten');
        return res.status(500).send(errorHtml('Fehler beim Laden älterer Nachrichten. Bitte Seite neu laden.'));
    }
}));

/**
 * POST /dms/send
 * Sendet eine Nachricht (Text und/oder Dateien) in einer Konversation.
 * @name POST /send
 * @function
 * @inner
 */
router.post('/send', dmUpload.array('file', 5), asyncHandler(async (req, res) => {
    const { conversation_id, message } = req.body;
    const sender_id = req.session.user.id;

    const text = (message || '').trim();
    const files = req.files || [];

    if (!text && files.length === 0) {
        // Fehler-Logging, um fehlende Nachrichten-Payloads von Clients zu diagnostizieren
        try {
            console.error('Ungültige /dms/send Anfrage: leere Nachricht und keine Dateien', {
                ip: req.ip,
                headers: {
                    'content-type': req.headers['content-type'],
                    'hx-request': req.headers['hx-request'] || req.get('HX-Request')
                },
                bodyKeys: Object.keys(req.body || {}),
                contentLength: req.headers['content-length'] || null,
                filesCount: (req.files || []).length
            });
        } catch (e) { console.error('Fehler beim Loggen der ungültigen Sendeanfrage', e); }
        return res.status(400).send(req.isHtmx ? 'Nachricht leer' : errorHtml('Nachricht leer'));
    }

    const messagesToRender = [];

    // 1) Text-Nachricht (falls vorhanden)
    if (text) {
      const msgRow = await saveMessage(conversation_id, sender_id, text);
      messagesToRender.push(msgRow);
    }

    // 2) Datei-Nachrichten
    for (const file of files) {
      const originalName = file.originalname;
      const filename = file.filename;
      const sizeKB = Math.round(file.size / 1024);
      const fileText = `[FILE] ${filename} | ${originalName} | ${sizeKB}`;

      const fileRow = await saveMessage(conversation_id, sender_id, fileText);
      messagesToRender.push(fileRow);
    }

    if (!messagesToRender.length) {
        notifyDmWaiters(conversation_id);
        return res.status(204).end();
    }

    const html = await renderMessageItems(res, messagesToRender, sender_id);
    notifyDmWaiters(conversation_id, { lastId: messagesToRender[messagesToRender.length - 1].message_id }, { excludeUserId: sender_id });

    // Informiert den Absender direkt mit HTML für ein optimistisches Update
    return res.send(html);
}));

/**
 * POST /dms/edit
 * Bearbeitet den Text einer bestehenden Direktnachricht.
 * @name POST /edit
 * @function
 * @inner
 */
router.post('/edit', asyncHandler(async (req, res) => {
    const { messageId, text, conversationId } = req.body;
    const userId = req.session.user.id;
    if (!messageId || !text) return res.status(400).send(req.isHtmx ? 'Ungültig' : errorHtml('Ungültig'));

    const success = await updateMessage(messageId, userId, text);
    if (success) {
        notifyDmWaiters(conversationId, { type: 'edit', messageId: Number(messageId) }, { excludeUserId: userId });
        return res.json({ ok: true });
    }
    res.status(403).send(req.isHtmx ? 'Nicht berechtigt oder Fehler' : errorHtml('Nicht berechtigt oder Fehler'));
}));

/**
 * POST /dms/delete
 * Löscht eine Direktnachricht (markiert sie als gelöscht).
 * @name POST /delete
 * @function
 * @inner
 */
router.post('/delete', asyncHandler(async (req, res) => {
    const { messageId, conversationId } = req.body;
    const userId = req.session.user.id;
    if (!messageId) return res.status(400).send(req.isHtmx ? 'Ungültig' : errorHtml('Ungültig'));

    const success = await deleteMessage(messageId, userId);
    if (success) {
        notifyDmWaiters(conversationId, { type: 'delete', messageId: Number(messageId) }, { excludeUserId: userId });
        return res.json({ ok: true });
    }
    res.status(403).send(req.isHtmx ? 'Nicht berechtigt oder Fehler' : errorHtml('Nicht berechtigt oder Fehler'));
}));

/**
 * GET /dms/direct/:userId
 * Erstellt oder findet eine Konversation mit einem Nutzer und leitet zur Chat-Seite weiter.
 * @name GET /direct/:userId
 * @function
 * @inner
 */
router.get('/direct/:userId', asyncHandler(async (req, res) => {
    const currentUserId = req.session.user.id;
    const otherUserId = parseInt(req.params.userId);

    if (currentUserId === otherUserId) return res.redirect('/dms');

    // Prüfen, ob der Benutzer existiert (PK-Lookup ist extrem schnell)
    const otherUser = await userService.getUserMinimal(otherUserId);
    if (!otherUser) return res.status(404).send(req.isHtmx ? "Nutzer nicht gefunden" : errorHtml("Nutzer nicht gefunden"));

    // Zur etablierten Chat-UI weiterleiten
    await getOrCreateConversation(currentUserId, otherUserId);
    res.redirect(`/dms/chat/${otherUserId}`);
}));

module.exports = router;

/**
 * GET /dms/file/:conversationId/:filename
 * Sicherer Datei-Server für Chat-Uploads.
 * Prüft den Zugriff auf die Konversation, bevor die Datei ausgeliefert wird.
 * @name GET /file/:conversationId/:filename
 * @function
 * @inner
 */
router.get('/file/:conversationId/:filename', asyncHandler(async (req, res) => {
    const conversationId = Number(req.params.conversationId);
    const filename = req.params.filename;
    if (!conversationId || !filename) return res.status(400).send(req.isHtmx ? 'Ungültig' : errorHtml('Ungültig'));

    const allowed = await ensureConversationAccess(conversationId, req.session.user.id);
    if (!allowed) return res.status(403).send(req.isHtmx ? 'Nicht berechtigt' : errorHtml('Nicht berechtigt'));

    // Verhindert Path Traversal
    if (filename.includes('..') || filename.includes('/')) return res.status(400).send(req.isHtmx ? 'Ungültig' : errorHtml('Ungültig'));

    const baseDir = path.join(__dirname, '..', 'data', 'uploads', 'chat');
    const plainPath = path.join(baseDir, filename);

    // Datei ausliefern, wenn vorhanden (und Zugriff erlaubt)
    if (fs.existsSync(plainPath)) {
        // Den ursprünglichen Dateinamen aus den Nachrichten-Logs für diese Konversation finden
        try {
            const downloadName = await getOriginalFilename(conversationId, filename);
            if (req.query.inline === '1') {
                return res.sendFile(plainPath);
            }
            return res.download(plainPath, downloadName);
        } catch (e) {
            console.error('Fehler beim Finden des ursprünglichen Dateinamens für DM:', e);
            if (req.query.inline === '1') {
                return res.sendFile(plainPath);
            }
            return res.download(plainPath);
        }
    }

    return res.status(404).send(req.isHtmx ? 'Nicht gefunden' : errorHtml('Nicht gefunden'));
}));
