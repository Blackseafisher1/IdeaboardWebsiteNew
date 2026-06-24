/**
 * @fileoverview In-Memory und Redis-synchronisierte Live-Update-Verwaltung.
 * Verwaltet Versionsnummern, Change-Log und SSE-Warte-Callbacks.
 * @module lib/liveUpdates
 */

const { redis, redisSub, ensureSubscribe, awaitRedisReady, safePublish } = require('./redis');

/** @constant {number} @readonly */
const MAX_LOG_ENTRIES = 200;

let globalVersion = 1;
/** @type {Map<string, number>} */
const ideaVersions = new Map(); // ideaId -> last version number
/** @type {Array<Object>} */
const changeLog = []; // { version, idea_id, action, idea_version, ...meta }
/** @type {Set<Object>} */
const sseWaiters = new Set(); // { since, trigger, cleanup }

// Abonniere prozessübergreifende Änderungen über Redis und verarbeite eingehende Nachrichten
ensureSubscribe('IDEABOARD_CHANGES');
// Redis-Subscriber: bei eingehenden Nachrichten den Payload parsen und als Änderung anwenden
redisSub.on('message', (channel, message) => {
  if (channel === 'IDEABOARD_CHANGES') {
    try {
      const data = JSON.parse(message);
      applyChange(data.ideaId, data.action, data.meta, true);
    } catch (e) { console.error('Redis-Synchronisationsfehler:', e && e.message ? e.message : e); }
  }
});

/**
 * Liefert die aktuelle globale Versionsnummer.
 * @returns {number}
 */
function getCurrentVersion() {
  return globalVersion;
}

/**
 * Liefert die zuletzt bekannte Version einer Idee.
 * @param {number|string} ideaId
 * @returns {number}
 */
function getIdeaVersion(ideaId) {
  return ideaVersions.get(String(ideaId)) || 0;
}

/**
 * Wendet eine Änderung an: erhöht die globale Version, aktualisiert Log und Versionen.
 * @param {number|string|null} ideaId - ID der betroffenen Idee oder `null`.
 * @param {string} action - Aktionstyp (z. B. 'create', 'update', 'delete').
 * @param {Object} [meta={}] - Zusätzliche Metadaten zur Änderung.
 * @param {boolean} [IsFromRedis=false] - `true`, wenn die Änderung aus Redis synchronisiert wurde.
 * @returns {Object} Das erzeugte Change-Objekt.
 */
function applyChange(ideaId, action, meta = {}, IsFromRedis = false) {
  // Einfache Duplikaterkennung, wenn Änderungen aus Redis stammen: falls eine identische Änderung
  // für dieselbe `idea_id` und `action` bereits im `changeLog` existiert, erneut überspringen.
  const ideaIdStr = ideaId != null ? String(ideaId) : null;
  if (IsFromRedis && ideaIdStr) {
    try {
      // Versuch, Duplikate zu erkennen: wenn für dieselbe Idee+Action bereits ein
      // Change-Log-Eintrag existiert, der die Meta-Daten enthält, überspringen.
      const metaStr = JSON.stringify(meta || {});
      const found = changeLog.find(e => e.idea_id === Number(ideaIdStr) && e.action === action && JSON.stringify(e).includes(metaStr));
      if (found) return found; // bereits angewendet
    } catch (e) {
      // Bei JSON-Fehlern nicht kritisch — Änderung wird normal angewendet
    }
  }
  globalVersion += 1;
  const ideaVersion = ideaIdStr ? globalVersion : null;

  if (ideaIdStr) ideaVersions.set(ideaIdStr, globalVersion);

  // Sanitize meta: BigInt-Werte in sichere JS-Typen umwandeln
/**
 * sanitizeValue — Funktion mit spezifischer Aufgabe, siehe Implementierung.
 *
 * @returns {*} Beschreibung des Rückgabewerts
 * @function sanitizeValue
 */
  /**
   * Sanitisiert Meta-Werte für das Change-Log: wandelt `bigint` in sichere JS-Typen um
   * (Number wenn innerhalb von SAFE_INTEGER, sonst String) und rekursiv über Objekte/Arrays.
   * @param {*} v - Ursprünglicher Meta-Wert
   * @returns {*} Sanitiserter Wert
   */
  function sanitizeValue(v) {
    if (typeof v === 'bigint') {
      if (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)) return Number(v);
      return v.toString();
    }
    if (Array.isArray(v)) return v.map(sanitizeValue);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = sanitizeValue(v[k]);
      return o;
    }
    return v;
  }

  const safeMeta = sanitizeValue(meta);

  const change = {
    version: globalVersion,
    idea_id: ideaIdStr ? Number(ideaIdStr) : null,
    action,
    idea_version: ideaVersion,
    ...safeMeta
  };

  changeLog.push(change);
  if (changeLog.length > MAX_LOG_ENTRIES) changeLog.shift();

  notifyWaiters();
  return change;
}

/**
 * Zeichnet eine Änderung auf und versucht, sie über Redis zu veröffentlichen.
 * @param {number|string|null} ideaId
 * @param {string} action
 * @param {Object} [meta={}] 
 * @returns {Promise<Object>|Object} Entweder ein Promise beim Redis-Publish oder das lokale Change-Objekt.
 */
function recordChange(ideaId, action, meta = {}) {
  // Wenn Redis verbunden ist, versuche zu publishen und überlasse Abonnenten die Reihenfolge.
  // Auf das Publish warten und bei Fehlschlag deterministisch lokal anwenden.
  if (redis.status === 'ready') {
    // Wenn Redis verfügbar ist, versuche die Änderung zu publishen. Falls Publish fehlschlägt,
    // wende lokal deterministisch an und logge den Fehler.
    return (async () => {
      try {
        await safePublish('IDEABOARD_CHANGES', { ideaId, action, meta });
        return { pending: true };
      } catch (err) {
        console.error('Redis publish failed — falling back to local apply:', err && err.message ? err.message : err);
        return applyChange(ideaId, action, meta);
      }
    })();
  }

  // Fallback for local-only (no Redis)
  return applyChange(ideaId, action, meta);
}

/**
 * Liefert alle Änderungen seit einer gegebenen Versionsnummer.
 * @param {number} since - Versionsnummer-Grundlage.
 * @returns {Array<Object>} Array mit Change-Objekten.
 */
function getChangesSince(since) {
  const sinceNum = Number.isFinite(since) ? since : 0;
  // Filtere Change-Log und liefere alle Einträge, deren Version größer als `since` ist.
  return changeLog.filter(entry => entry.version > sinceNum);
}

/**
 * Benachrichtigt registrierte SSE-Warte-Callbacks, falls neue Änderungen vorliegen.
 */
function notifyWaiters() {
  // SSE waiters
  for (const waiter of Array.from(sseWaiters)) {
    if (globalVersion > waiter.since) {
      const changes = getChangesSince(waiter.since);
      if (changes.length > 0) {
        waiter.trigger({ version: globalVersion, changes });
        waiter.since = globalVersion;
      }
    }
  }
}

/**
 * Registriert einen SSE-Warte-Callback, der bei neuen Änderungen ausgelöst wird.
 * @param {number} since - Versionsnummer, ab der Änderungen gewünscht sind.
 * @param {function(Object):void} trigger - Callback, das mit einem Objekt `{version, changes}` aufgerufen wird.
 * @returns {Object} Ein Warte-Handle mit einer `cleanup()`-Methode zum Entfernen.
 */
function registerSSEWaiter(since, trigger) {
  const waiter = {
    since,
    trigger,
    // Entfernt diesen Waiter aus der internen Menge (cleanup-Funktion für z. B. Verbindungsschluss)
    cleanup: () => sseWaiters.delete(waiter)
  };
  sseWaiters.add(waiter);
  return waiter;
}

module.exports = {
  getCurrentVersion,
  getIdeaVersion,
  recordChange,
  getChangesSince,
  registerSSEWaiter
};
