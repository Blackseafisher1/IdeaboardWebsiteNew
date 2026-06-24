/**
 * @fileoverview Hilfsfunktionen für Datenbankzugriffe und -fehlerbehandlung.
 * @module lib/dbHelpers
 */

/**
 * Führt eine Datenbankabfrage mit begrenzten Wiederholungsversuchen bei transienten Fehlern aus.
 * @async
 * @param {Object} conn - Datenbankverbindung mit einer `query(sql, params)`-Methode.
 * @param {string} sql - SQL-Statement.
 * @param {Array<any>} [params=[]] - Parameter für das SQL-Statement.
 * @returns {Promise<any>} Ergebnis der `conn.query`-Ausführung.
 * @throws {Error} Wenn alle Wiederholungsversuche fehlschlagen oder ein nicht wiederholbarer Fehler auftritt.
 */
async function executeWithRetry(conn, sql, params = []) {
  const RETRY_ERRNOS = new Set([1020, 1205, 1213]); // ER_CHECKREAD, ER_LOCK_WAIT_TIMEOUT, ER_LOCK_DEADLOCK
  const MAX_ATTEMPTS = 3;
  let attempt = 0;
  while (true) {
    try {
      return await conn.query(sql, params);
    } catch (err) {
      attempt++;
      const shouldRetry = err && err.errno && RETRY_ERRNOS.has(err.errno) && attempt < MAX_ATTEMPTS;
      if (shouldRetry) {
        const delay = 50 * attempt; // 50ms, 100ms, ...
        console.warn(`Transient DB error (errno=${err.errno}), retrying attempt ${attempt}/${MAX_ATTEMPTS} after ${delay}ms`);
        // Kurze Wartezeit (exponentielles Backoff-ähnlich): Verzögerung vor erneutem Versuch
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Gibt sicher den ersten Wert eines Abfrageergebnisses zurück oder einen Fallback.
 * @param {any|Array<any>} v - Ergebnis einer Abfrage (Array oder einfacher Wert).
 * @param {any} [fallback=''] - Rückgabewert, falls `v` leer oder undefined ist.
 * @returns {any} Erster Wert von `v` oder `fallback`.
 */
function firstQueryValue(v, fallback = '') {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return (v ?? fallback);
}

module.exports = {
  executeWithRetry,
  firstQueryValue
};
