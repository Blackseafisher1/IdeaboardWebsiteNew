/**
 * @fileoverview Presence-Tracking für Gruppen: lokale + Redis-synchronisierte Benachrichtigungen.
 * @module lib/services/groupPresenceService
 */
const { redis, redisSub, safePublish } = require('../redis');

/** @type {Map<number, Set<Object>>} */
const groupWaiters = new Map(); // groupId -> Set von Waitern
/** @type {Map<number, Map<number, number>>} */
const groupPresence = new Map(); // groupId -> Map(userId -> connectionCount)

// Abonniere Gruppen-Updates (Subscriber-Client)
redisSub.subscribe('GROUP_UPDATES').catch(() => {});

// Verarbeite eingehende Redis-Nachrichten und leite sie lokal an Waiter weiter
redisSub.on('message', (channel, message) => {
    if (channel === 'GROUP_UPDATES') {
        try {
            const data = JSON.parse(message);
            // payload und options können für prozessübergreifende Lieferung vorhanden sein
            localNotifyGroupWaiters(data.groupId, data.payload, data.options || null);
        } catch (e) { console.error('Group-Synchronisationsfehler:', e); }
    }
});

/**
 * Erhöht die Präsenz eines Nutzers in einer Gruppe.
 * @param {number|string} groupId
 * @param {number} userId
 * @returns {void}
 */
function incrementPresence(groupId, userId) {
    const gId = Number(groupId);
    if (isNaN(gId)) return;
    const map = groupPresence.get(gId) || new Map();
    map.set(userId, (map.get(userId) || 0) + 1);
    groupPresence.set(gId, map);
    broadcastPresence(gId);
}

/**
 * Verringert die Präsenz-Anzahl eines Nutzers in einer Gruppe.
 * @param {number|string} groupId
 * @param {number} userId
 * @returns {void}
 */
function decrementPresence(groupId, userId) {
    const gId = Number(groupId);
    if (isNaN(gId)) return;
    const map = groupPresence.get(gId);
    if (!map) return;
    const cnt = (map.get(userId) || 0) - 1;
    if (cnt <= 0) map.delete(userId); else map.set(userId, cnt);
    if (map.size === 0) groupPresence.delete(gId); else groupPresence.set(gId, map);
    broadcastPresence(gId);
}

/**
 * Liefert User-IDs, die in einer Gruppe aktuell online sind.
 * @param {number|string} groupId
 * @returns {Array<number>}
 */
function getPresenceList(groupId) {
    const map = groupPresence.get(Number(groupId));
    // Liefert die User-IDs als Nummernarray
    return map ? Array.from(map.keys()).map(k => Number(k)) : [];
}

/**
 * Broadcastet Presence-Updates an registrierte Waiter einer Gruppe.
 * @param {number|string} groupId
 * @returns {void}
 */
function broadcastPresence(groupId) {
    const waiters = groupWaiters.get(Number(groupId));
    if (!waiters) return;
    const online = getPresenceList(groupId);
    for (const waiter of Array.from(waiters)) {
        if (waiter.sse && waiter.trigger) {
            try { waiter.trigger({ presence: { online } }); } catch (e) { console.error('presence trigger error', e); }
        }
    }
}

/**
 * Lokal benachrichtigen aller Waiter einer Gruppe (kein Redis-Publish).
 * @private
 */
function localNotifyGroupWaiters(groupId, payload = null, options = null) {
    const waiters = groupWaiters.get(Number(groupId));
    if (!waiters) return;
    for (const waiter of Array.from(waiters)) {
        // If options.excludeUserId is provided, skip notifying that user's connections
        if (options && options.excludeUserId && waiter.userId === Number(options.excludeUserId)) continue;
        if (waiter.sse && waiter.trigger) {
            waiter.trigger(payload);
        }
    }
}

/**
 * Benachrichtigt Waiter über Redis (falls verfügbar) oder lokal als Fallback.
 * @param {number|string} groupId
 * @param {any} [payload]
 * @param {Object|null} [options]
 * @returns {void}
 */
function notifyGroupWaiters(groupId, payload = null, options = null) {
    if (redis.status === 'ready') {
        // Versuche Publish über Redis; bei Fehlern Fallback auf lokale Benachrichtigung
        safePublish('GROUP_UPDATES', { groupId, payload, options }).catch((err) => {
            console.error('GROUP_UPDATES publish failed, falling back locally:', err && err.message ? err.message : err);
            localNotifyGroupWaiters(groupId, payload, options);
        });
    } else {
        localNotifyGroupWaiters(groupId, payload, options);
    }
}

module.exports = {
    incrementPresence,
    decrementPresence,
    getPresenceList,
    broadcastPresence,
    notifyGroupWaiters,
    groupWaiters
};

