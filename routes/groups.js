/**
 * @fileoverview Gruppen-Chat-Routen: Gruppenliste, Chat-Room, SSE-Updates und Gruppenmanagement.
 * Verwendet `groupService` und `groupPresenceService` für Nachrichten- und Präsenzlogik.
 * @module routes/groups
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../lib/asyncHandler');
const { isLoggedIn } = require('./middleware');
const { errorHtml } = require('../lib/http');
const groupService = require('../lib/services/groupService');
const ProjectService = require('../lib/services/projectService');
const { dmUpload } = require('../lib/services/dmFilesService');
const { 
    incrementPresence, 
    decrementPresence, 
    getPresenceList, 
    notifyGroupWaiters, 
    groupWaiters 
} = require('../lib/services/groupPresenceService');
const htmxDetector = require('../lib/htmxDetector');
const { isAdmin: hasAdminRole } = require('../lib/roleHelpers');
const path = require('path');
const fs = require('fs');

router.use(isLoggedIn);
router.use(htmxDetector.middleware);

/**
 * Hilfsfunktion zum Rendern von Nachrichten-Items.
 * Verwendet derzeit das DM-Partial, da die Struktur identisch ist.
 * @param {object} res - Express Response Objekt
 * @param {Array} messages - Liste der Nachrichten
 * @param {number} currentUserId - ID des aktuellen Nutzers
 * @returns {Promise<string>} HTML der gerenderten Nachrichten
 */
function renderMessageItems(res, messages, currentUserId) {
    /**
     * Rendert das Partial `dms/partials/message_items` und liefert das HTML
     * als Promise-Resultat. Das Promise lehnt bei Renderfehler ab.
     * @returns {Promise<string>} Gerendertes HTML-Fragment
     */
    return new Promise((resolve, reject) => {
        res.render('dms/partials/message_items', { messages, currentUserId, layout: false, isGroup: true }, (err, html) => {
            if (err) return reject(err);
            resolve(html);
        });
    });
}

/**
 * GET /groups/
 * Umleitung zur Projektseite, da die Gruppen-Inbox entfernt wurde.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
    res.redirect('/projects');
}));

/**
 * GET /groups/chat/:id
 * Zeigt den Chatroom einer spezifischen Gruppe an.
 * Führt bei Bedarf eine automatische Synchronisierung für Projekt-Gruppen durch.
 * @name GET /chat/:id
 * @function
 * @inner
 */
router.get('/chat/:id', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const userId = req.session.user.id;

    let isMem = await groupService.isMember(groupId, userId);
    
    // Automatisches Sync für Projekt-Gruppen
    if (!isMem) {
        const group = await groupService.getGroupById(groupId);
        if (group && group.project_id) {
            const isTeamMember = await ProjectService.isTeamMember(group.project_id, userId);
            if (isTeamMember) {
                const role = await ProjectService.getTeamMemberRole(group.project_id, userId);
                const groupRole = role === 'Leiter' ? 'admin' : 'member';
                await groupService.addMember(groupId, userId, groupRole);
                isMem = true;
            }
        }
    }

    if (!isMem) {
        const isAdmin = hasAdminRole(req.session.user);
        if (!isAdmin) {
            return res.status(403).send(req.isHtmx ? 'Kein Zugriff auf diese Gruppe.' : errorHtml('Kein Zugriff auf diese Gruppe.'));
        }
        // Admins dürfen die Gruppe ansehen, erhalten aber nur View-Only (keine Schreibrechte)
    }

    const group = await groupService.getGroupById(groupId);
    // Initial render fetches up to 20 latest messages
    const messages = await groupService.fetchLatestGroupMessages(groupId, 20);
    const members = await groupService.getGroupMembers(groupId);
    const myRole = isMem ? await groupService.getMemberRole(groupId, userId) : 'viewer';

    const isMember = !!isMem;
    const isAdminViewer = !isMem && hasAdminRole(req.session.user);

    res.render('groups/chat', {
        group,
        messages,
        members,
        myRole,
        isMember,
        isAdminViewer,
        user: req.session.user,
        currentConversationId: `group:${groupId}`, // Für Client-Kompatibilität
        groupId,
        activePage: 'chat'
    });
}));

/**
 * GET /groups/chat/:id/history
 * Liefert ältere Nachrichten für die Pagination.
 * @name GET /chat/:id/history
 * @function
 * @inner
 */
router.get('/chat/:id/history', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const userId = req.session.user.id;
    const beforeId = parseInt(req.query.beforeId, 10);

    if (isNaN(beforeId)) return res.status(400).send(req.isHtmx ? 'Ungültige ID' : errorHtml('Ungültige ID'));
    const isMemHistory = await groupService.isMember(groupId, userId);
    const isAdminHistory = hasAdminRole(req.session.user);
    if (!isMemHistory && !isAdminHistory) return res.status(403).send(req.isHtmx ? 'Kein Zugriff' : errorHtml('Kein Zugriff'));

    const messages = await groupService.getGroupMessagesBefore(groupId, beforeId, 20);
    
    // Wir rendern die Nachrichten und hängen einen "Load More" Trigger an den Anfang, falls nötig
    const html = await renderMessageItems(res, messages, userId);
    
    if (messages.length === 20) {
        const oldestId = messages[0].message_id;
        res.send(`
            <div class="load-more-wrapper" style="display: flex; justify-content: center; padding: 20px 10px; width: 100%;">
                <div class="load-more-container btn secondary" 
                     hx-get="/groups/chat/${groupId}/history?beforeId=${oldestId}" 
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
}));

/**
 * GET /groups/updates/:id
 * SSE-Endpunkt für Echtzeit-Updates in einer Gruppe (neue Nachrichten, Bearbeitungen, Löschungen, Präsenz).
 * @name GET /updates/:id
 * @function
 * @inner
 */
router.get('/updates/:id', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const currentUserId = req.session.user.id;
    let afterId = parseInt(req.query.afterId, 10);
    if (isNaN(afterId)) afterId = 0;

    const isMemSse = await groupService.isMember(groupId, currentUserId);
    const isAdminSse = hasAdminRole(req.session.user);
    if (!isMemSse && !isAdminSse) {
        return res.status(403).end();
    }

    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('\n');

        let isProcessing = false;
        let pending = false;

        /**
         * sendUpdate ist ein Express-Route-Handler und verarbeitet Anfragen für diese Route.
         * Serialisiert Anfragen, um Race-Conditions bei parallelen Triggern zu vermeiden.
         *
         * @returns {Promise<void>}
         * @function sendUpdate
         */
        const sendUpdate = async (payload = null) => {
            if (isProcessing) { pending = true; return; }
            isProcessing = true;

            try {
                if (payload && payload.presence) {
                    const online = getPresenceList(groupId);
                    res.write(`event: presence\ndata: ${JSON.stringify({ online })}\n\n`);
                    return;
                }

                if (payload && (payload.type === 'edit' || payload.type === 'delete')) {
                    const message = await groupService.getMessageById(payload.messageId);
                    if (message) {
                        const html = await renderMessageItems(res, [message], currentUserId);
                        res.write(`event: marker\ndata: ${JSON.stringify({ 
                            type: 'update', 
                            messageId: payload.messageId, 
                            html, 
                            action: payload.type,
                            updatedAt: message.updated_at
                        })}\n\n`);
                        return;
                    }
                }

                const messages = await groupService.getGroupMessages(groupId, afterId);

                if (messages.length > 0) {
                    const html = await renderMessageItems(res, messages, currentUserId);
                    afterId = messages[messages.length - 1].message_id;
                    res.write(`data: ${JSON.stringify({ html, lastId: afterId })}\n\n`);
                }

                const online = getPresenceList(groupId);
                res.write(`event: presence\ndata: ${JSON.stringify({ online })}\n\n`);
            } finally {
                isProcessing = false;
                if (pending) {
                    pending = false;
                    setTimeout(() => sendUpdate().catch(e => console.error('SSE loop e:', e)), 10);
                }
            }
        };

        const contributesPresence = !!isMemSse; // only real members contribute to presence
        const waiter = {
            sse: true,
            userId: currentUserId,
            // Trigger-Funktion: löst ein Update aus und protokolliert Fehler
            trigger: (payload) => sendUpdate(payload).catch(err => console.error('SSE Trigger Fehler:', err)),
            // Cleanup-Funktion: entfernt diesen Waiter aus der Warteliste und
            // reduziert den Präsenzzähler für den Nutzer in der Gruppe
            cleanup: () => {
                const set = groupWaiters.get(Number(groupId));
                if (set) {
                    set.delete(waiter);
                    if (set.size === 0) groupWaiters.delete(Number(groupId));
                }
                if (contributesPresence) decrementPresence(groupId, currentUserId);
            }
        };

        const set = groupWaiters.get(Number(groupId)) || new Set();
        set.add(waiter);
        groupWaiters.set(Number(groupId), set);

        if (contributesPresence) incrementPresence(groupId, currentUserId);

        // Heartbeat: hält die SSE-Verbindung bei Proxies/Tunneln aktiv
        const heartbeat = setInterval(() => {
            try {
                res.write(': heartbeat\n\n');
            } catch (e) {
                clearInterval(heartbeat);
            }
        }, 15000);

        req.on('close', () => {
            clearInterval(heartbeat);
            waiter.cleanup();
        });

        try {
            await sendUpdate(); // Initialer Status
        } catch (e) {
            console.error('Initial group SSE sendUpdate failed:', e);
        }
    } else {
        res.status(400).end();
    }
}));

// ==========================================
// 4. Message Actions
// ==========================================

router.post('/send', dmUpload.array('file', 5), asyncHandler(async (req, res) => {
    const { message } = req.body;
    let { groupId } = req.body;
    
    // Support both groupId and conversationId for compatibility
    if (!groupId && req.body.conversationId) groupId = req.body.conversationId;
    if (!groupId && req.body.conversation_id) groupId = req.body.conversation_id;

    const userId = req.session.user.id;
    const text = (message || '').trim();
    const files = req.files || [];

    if (!groupId) {
        console.warn('[groups/send] Missing groupId in request body:', req.body);
        return res.status(400).json({ error: 'missing_groupId', body: req.body });
    }

    if (!text && files.length === 0) {
        return res.status(400).json({ error: 'invalid_payload' });
    }

    if (!(await groupService.isMember(groupId, userId))) {
        return res.status(403).json({ error: 'Nicht berechtigt' });
    }

    const messagesToRender = [];

    if (text) {
        const msg = await groupService.saveMessage(groupId, userId, text);
        messagesToRender.push(msg);
    }

    for (const file of files) {
        const fileText = `[FILE] ${file.filename} | ${file.originalname} | ${Math.round(file.size / 1024)}`;
        const msg = await groupService.saveMessage(groupId, userId, fileText, 'file', file.filename, Math.round(file.size / 1024));
        messagesToRender.push(msg);
    }

    if (messagesToRender.length > 0) {
        const html = await renderMessageItems(res, messagesToRender, userId);
        const lastMsgId = messagesToRender[messagesToRender.length - 1]?.message_id;
        if (lastMsgId) {
            notifyGroupWaiters(groupId, { lastId: lastMsgId }, { excludeUserId: userId });
        }
        return res.send(html);
    }

    res.status(204).end();
}));


router.post('/edit', asyncHandler(async (req, res) => {
    const { messageId, text, groupId } = req.body;
    const userId = req.session.user.id;
    const success = await groupService.updateMessage(messageId, userId, text);
    if (success) {
        notifyGroupWaiters(groupId, { type: 'edit', messageId }, { excludeUserId: userId });
        return res.json({ ok: true });
    }
    res.status(403).json({ error: 'failed' });
}));


router.post('/delete', asyncHandler(async (req, res) => {
    const { messageId, groupId } = req.body;
    const userId = req.session.user.id;
    const success = await groupService.deleteMessage(messageId, userId);
    if (success) {
        notifyGroupWaiters(groupId, { type: 'delete', messageId }, { excludeUserId: userId });
        return res.json({ ok: true });
    }
    res.status(403).json({ error: 'failed' });
}));

// ==========================================
// 5. Group Management
// ==========================================

router.post('/create', asyncHandler(async (req, res) => {
    const { name, isPrivate } = req.body;
    const userId = req.session.user.id;
    const groupId = await groupService.createGroup({ name, ownerUserId: userId, isPrivate: isPrivate === 'on' });
    res.redirect(`/groups/chat/${groupId}`);
}));


router.post('/:id/leave', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const userId = req.session.user.id;
    // Leaving a group manually is disabled because groups are bound to projects/teams.
    // If a user must be removed, they should be removed from the project team
    // (which will be synced to the group chat), or the project can be deleted.
    res.status(403).send(req.isHtmx ? 'Das Verlassen von Gruppen ist deaktiviert.' : errorHtml('Das Verlassen von Gruppen ist deaktiviert.'));
}));


router.post('/:id/members/add', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const { userId } = req.body;
    const currentUserId = req.session.user.id;
    
    const role = await groupService.getMemberRole(groupId, currentUserId);
    if (role !== 'owner' && role !== 'admin') {
        return res.status(403).send(req.isHtmx ? 'Nur Admins können Mitglieder hinzufügen.' : errorHtml('Nur Admins können Mitglieder hinzufügen.'));
    }

    await groupService.addMember(groupId, userId);
    notifyGroupWaiters(groupId);
    res.redirect(`/groups/chat/${groupId}`);
}));


router.post('/:id/members/remove', asyncHandler(async (req, res) => {
    const groupId = req.params.id;
    const { userId } = req.body;
    const currentUserId = req.session.user.id;
    
    const role = await groupService.getMemberRole(groupId, currentUserId);
    if (role !== 'owner' && role !== 'admin') {
        return res.status(403).send(req.isHtmx ? 'Nur Admins können Mitglieder entfernen.' : errorHtml('Nur Admins können Mitglieder entfernen.'));
    }

    await groupService.removeMember(groupId, userId);
    notifyGroupWaiters(groupId);
    res.redirect(`/groups/chat/${groupId}`);
}));

// Secure file serve for group chat uploads. Path: /groups/file/:groupId/:filename

router.get('/file/:groupId/:filename', asyncHandler(async (req, res) => {
    const groupId = Number(req.params.groupId);
    const filename = req.params.filename;
    if (!groupId || !filename) return res.status(400).send(req.isHtmx ? 'invalid' : errorHtml('invalid'));

    const isMemFile = await groupService.isMember(groupId, req.session.user.id);
    const isAdminFile = hasAdminRole(req.session.user);
    if (!isMemFile && !isAdminFile) {
        return res.status(403).send(req.isHtmx ? 'Nicht berechtigt' : errorHtml('Nicht berechtigt'));
    }

    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) return res.status(400).send(req.isHtmx ? 'invalid' : errorHtml('invalid'));

    const baseDir = path.join(__dirname, '..', 'data', 'uploads', 'chat');
    const plainPath = path.join(baseDir, filename);

    // Serve plaintext if present (and access allowed)
    if (fs.existsSync(plainPath)) {
        // Find the original name from the message logs for this group
        try {
            const downloadName = await groupService.getOriginalFilename(groupId, filename);
            if (req.query.inline === '1') {
                return res.sendFile(plainPath);
            }
            return res.download(plainPath, downloadName);
        } catch (e) {
            console.error('Error finding original filename for Group Chat:', e);
            if (req.query.inline === '1') {
                return res.sendFile(plainPath);
            }
            return res.download(plainPath);
        }
    }

    return res.status(404).send(req.isHtmx ? 'not found' : errorHtml('not found'));
}));

module.exports = router;
