/**
 * @fileoverview Benutzerbezogene Hilfsfunktionen: Profile, Punkte-Update und Utilities.
 * Kleinere Transaktionen und Retry-Logik sind hier gekapselt.
 * JSDoc-Kommentare in Deutsch.
 * @module lib/services/userService
 */

const db = require('../../config/db.js');

async function updateUserPoints(userId) {
    try {
        const result = await db.query(
            'UPDATE user_points SET current_points = current_points + pending_delta, pending_delta = 0 WHERE user_id = ? AND pending_delta <> 0',
            [userId]
        );
        return result.affectedRows || 0;
    } catch (err) {
        console.error('Points update error:', err);
        return 0;
    }
}

async function getUserProfile(userId) {
    /**
     * Liefert das Benutzerprofil inklusive Punkteständen.
     * @async
     * @param {number|string} userId
     * @returns {Promise<object|null>} Profilobjekt oder `null` wenn nicht gefunden.
     */
    const userRows = await db.query(`-- sql 
        SELECT u.user_id, u.username, u.email, u.role_id, r.name as role_name,
               up.current_points, up.pending_delta
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN user_points up ON u.user_id = up.user_id
        WHERE u.user_id = ?
    `, [userId]);
    const user = userRows[0];
    return user;
}
/**
 * Führt eine Query mit Retry-Logik bei transienten Sperrfehlern aus.
 * @async
 * @param {string} sql - SQL-Statement.
 * @param {Array<any>} [params=[]] - SQL-Parameter.
 * @param {number} [maxAttempts=3] - Maximale Wiederholungen.
 * @returns {Promise<any>} Ergebnis der Query.
 */
async function queryWithLockRetry(sql, params = [], maxAttempts = 3) {
    const TRANSIENT_ERRNOS = new Set([1205, 1213]);
    let attempt = 0;
    while (true) {
        try {
            return await db.query(sql, params);
        } catch (err) {
            attempt++;
            const errno = err && err.errno;
            if (TRANSIENT_ERRNOS.has(errno) && attempt < maxAttempts) {
                // Exponentielles Backoff: erhöhe Wartezeit vor erneutem Versuch
                const backoff = 50 * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, backoff));
                continue;
            }
            throw err;
        }
    }
}

async function getUserMinimal(userId) {
    /**
     * Liefert eine minimale Benutzerrepräsentation (ID + Username).
     * @async
     * @param {number|string} userId
    * @returns {Promise.<Object>|null}
     */
    const rows = await db.query(
        'SELECT user_id, username FROM users WHERE user_id = ?',
        [userId]
    );
    return rows[0];
}
    /**
     * Aktualisiert den Nutzernamen eines Benutzers.
     * @async
     * @param {number|string} userId
     * @param {string} newUsername
     * @returns {Promise<void>}
     */
async function updateUsername(userId, newUsername) {

    if (!newUsername) throw new Error('Username is required');
    const clean = String(newUsername).trim();

    // Verhindere Kollisionen nur durch Groß-/Kleinschreibung
        const conflictRows = await queryWithLockRetry('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?) AND user_id != ?', [clean, userId]);
    if (conflictRows && conflictRows.length) throw new Error('Benutzername bereits vergeben');

    await queryWithLockRetry('UPDATE users SET username = ? WHERE user_id = ?', [clean, userId]);
}

module.exports = {
    updateUserPoints,
    getUserProfile,
    getUserMinimal,
    updateUsername,
    queryWithLockRetry
};


