/**
 * @fileoverview Presence-Tracking für Direktnachrichten: lokale und Redis-synchronisierte Benachrichtigungen.
 * @module lib/services/dmPresenceService
 */
const { redis, redisSub, safePublish } = require('../redis');

/** @type {Map<number, Set<Object>>} */
const dmWaiters = new Map(); // conversationId -> Set von Waiter-Objekten

/** @type {Map<number, Map<number, number>>} */
const conversationPresence = new Map(); // conversationId -> Map(userId -> connectionCount)

// Abonniere DM-Updates am Subscriber-Client (best-effort)
redisSub.subscribe('DM_UPDATES').catch(() => {});

// Eingehende Redis-Nachrichten für DM-Updates verarbeiten und lokal weiterleiten
redisSub.on('message', (channel, message) => {
    if (channel === 'DM_UPDATES') {
        try {
            const data = JSON.parse(message);
            localNotifyDmWaiters(data.conversationId, data.payload, data.options || null);
        } catch (e) { console.error('DM-Synchronisationsfehler:', e); }
    }
});

/**
 * Erhöht die Präsenz-Anzahl für einen Nutzer in einer Konversation.
 * @param {number|string} conversationId
 * @param {number} userId
 * @returns {void}
 */
function incrementPresence(conversationId, userId) {
    const convId = Number(conversationId);
    if (isNaN(convId)) return;
    const map = conversationPresence.get(convId) || new Map();
    map.set(userId, (map.get(userId) || 0) + 1);
    conversationPresence.set(convId, map);
    // An alle Waiter senden
    broadcastPresence(convId);
}

/**
 * Verringert die Präsenz-Anzahl für einen Nutzer in einer Konversation.
 * @param {number|string} conversationId
 * @param {number} userId
 * @returns {void}
 */
function decrementPresence(conversationId, userId) {
    const convId = Number(conversationId);
    if (isNaN(convId)) return;
    const map = conversationPresence.get(convId);
    if (!map) return;
    const cnt = (map.get(userId) || 0) - 1;
    if (cnt <= 0) map.delete(userId); else map.set(userId, cnt);
    if (map.size === 0) conversationPresence.delete(convId); else conversationPresence.set(convId, map);
    broadcastPresence(convId);
}

/**
 * Liefert eine Liste von User-IDs, die in einer Konversation online sind.
 * @param {number|string} conversationId
 * @returns {Array<number>}
 */
function getPresenceList(conversationId) {
    const map = conversationPresence.get(Number(conversationId));
    // Liefere die Liste der Online-User-IDs als Nummernarray
    return map ? Array.from(map.keys()).map(k => Number(k)) : [];
}

/**
 * Sendet Presence-Update an alle registrierten Warte-Callbacks einer Konversation.
 * @param {number|string} conversationId
 * @returns {void}
 */
function broadcastPresence(conversationId) {
    const waiters = dmWaiters.get(Number(conversationId));
    if (!waiters) return;
    const online = getPresenceList(conversationId);
    for (const waiter of Array.from(waiters)) {
        if (waiter.sse && waiter.trigger) {
            try { waiter.trigger({ presence: { online } }); } catch (e) { console.error('presence trigger error', e); }
        }
    }
}

/**
 * Lokal benachrichtigen (keine Redis-Publish) aller Warte-Callbacks einer Konversation.
 * @private
 */
function localNotifyDmWaiters(conversationId, payload = null, options = null) {
    const waiters = dmWaiters.get(Number(conversationId));
    if (!waiters) return;
    for (const waiter of Array.from(waiters)) {
        if (options && options.excludeUserId && waiter.userId === Number(options.excludeUserId)) continue;
        if (waiter.sse && waiter.trigger) {
            waiter.trigger(payload);
        }
    }
}

/**
 * Benachrichtigt Warte-Callbacks, versucht Redis-Publish wenn möglich, sonst lokal.
 * @param {number|string} conversationId
 * @param {any} [payload]
 * @param {Object|null} [options]
 * @returns {void}
 */
function notifyDmWaiters(conversationId, payload = null, options = null) {
    if (redis.status === 'ready') {
        // Versuche Publish über Redis; bei Fehlern Fallback auf lokale Benachrichtigung
        safePublish('DM_UPDATES', { conversationId, payload, options }).catch((err) => {
            console.error('DM_UPDATES publish failed, falling back locally:', err && err.message ? err.message : err);
            localNotifyDmWaiters(conversationId, payload, options);
        });
    } else {
        localNotifyDmWaiters(conversationId, payload, options);
    }
}

module.exports = {
    incrementPresence,
    decrementPresence,
    getPresenceList,
    broadcastPresence,
    notifyDmWaiters,
    dmWaiters
};

