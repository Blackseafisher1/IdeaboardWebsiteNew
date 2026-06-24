/**
 * @fileoverview Authentifizierungs- und Benutzerverwaltungsfunktionen (Hashing, Registrierung, Login).
 * @module lib/services/authService
 */
const db = require('../../config/db.js');
const pointsService = require('./pointsService');
const isBun = typeof Bun !== 'undefined';
let nodeArgon2;

/**
 * Einheitlicher Hashing-Service mit Unterstützung für Bun und Node (argon2).
 */
const hashService = {
    // Einheitliche Konfiguration
    config: {
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 1,
        type: 'argon2id'
    },

    /**
     * Hasht ein Passwort mittels Argon2 (unterstützt Bun- und Node-Implementierungen).
     * @async
     * @param {string} password - Klartext-Passwort.
     * @returns {Promise<string>} Generierter Passwort-Hash.
     */
    async hash(password) {
        if (isBun) {
            return await Bun.password.hash(password, {
                algorithm: 'argon2id',
                memoryCost: this.config.memoryCost,
                timeCost: this.config.timeCost
            });
        } else {
            if (!nodeArgon2) nodeArgon2 = await import('argon2');
            return await nodeArgon2.hash(password, {
                type: nodeArgon2.argon2id,
                memoryCost: this.config.memoryCost,
                timeCost: this.config.timeCost
            });
        }
    },

    /**
     * Verifiziert ein Passwort anhand eines gespeicherten Hashes.
     * @async
     * @param {string} password - Klartext-Passwort.
     * @param {string} hash - Gespeicherter Passwort-Hash.
     * @returns {Promise<boolean>} `true`, wenn das Passwort gültig ist.
     */
    async verify(password, hash) {
        if (!hash || !password) return false;
        if (isBun) {
            return await Bun.password.verify(password, hash);
        } else {
            if (!nodeArgon2) nodeArgon2 = await import('argon2');
            return await nodeArgon2.verify(hash, password);
        }
    }
};

const crypto = require('crypto');

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@ideenboard.de';

let DEFAULT_ADMIN_PASSWORD = null;
let INITIAL_ADMIN_PASSWORD_GENERATED = false;

/**
 * Stellt Standard-Rollen in der Datenbank sicher.
 * @async
 * @returns {Promise<void>}
 */
async function ensureRoles() {
    try {
                await db.query(`
            INSERT IGNORE INTO roles (role_id, name, description) VALUES
            (1, 'Admin', 'Administrator'),
            (2, 'Projektleiter', 'Projektleiter'),
            (3, 'Mitarbeiter', 'Mitarbeiter')
        `);
    } catch (err) {
        console.error('❌ Konnte Standard-Rollen nicht sicherstellen:', err.message);
    }
}

/**
 * Erstellt ggf. einen Default-Admin-Account und gibt ein einmaliges Passwort aus.
 * @async
 * @returns {Promise<void>}
 */
async function ensureDefaultAdmin() {
    let GENERATED_ADMIN_PASSWORD = null;

    try {
        await ensureRoles();
        const adminRoleRows = await db.query('SELECT role_id FROM roles WHERE name = ?', ['Admin']);
        const adminRole = adminRoleRows[0];
        const adminRoleId = adminRole?.role_id || 1;

        const existing = await db.query(
            'SELECT user_id, password_hash, username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
            [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL]
        );
        if (existing.length === 0) {
            if (!DEFAULT_ADMIN_PASSWORD) {
                GENERATED_ADMIN_PASSWORD = crypto.randomBytes(4).toString('hex').slice(0, 8);
                DEFAULT_ADMIN_PASSWORD = GENERATED_ADMIN_PASSWORD;
                INITIAL_ADMIN_PASSWORD_GENERATED = true;
            }
            const hash = await hashService.hash(DEFAULT_ADMIN_PASSWORD);
                const insertRes = await db.query(
                    'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
                    [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, hash, adminRoleId]
                );
            const adminUserId = insertRes?.insertId;
                if (adminUserId) {
                await db.query(
                    'INSERT IGNORE INTO user_points (user_id, current_points, pending_delta) VALUES (?, 0, 0)',
                    [adminUserId]
                );
                console.log(`[INIT] Default Admin '${DEFAULT_ADMIN_USERNAME}' angelegt.`);
                if (INITIAL_ADMIN_PASSWORD_GENERATED) {
                    console.log('EINMAL-ADMIN-PASSWORT:', GENERATED_ADMIN_PASSWORD);
                }
            }
        } else {
            const admin = existing[0];
            const pwd = admin.password_hash;
            if (!DEFAULT_ADMIN_PASSWORD && (!pwd || pwd === '' || pwd === null)) {
                GENERATED_ADMIN_PASSWORD = crypto.randomBytes(4).toString('hex').slice(0, 8);
                DEFAULT_ADMIN_PASSWORD = GENERATED_ADMIN_PASSWORD;
                const hash = await hashService.hash(DEFAULT_ADMIN_PASSWORD);
                await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, admin.user_id]);
                console.log('EINMAL-ADMIN-PASSWORT (Update):', GENERATED_ADMIN_PASSWORD);
            }
        }
    } catch (err) {
        console.error('❌ Konnte Default-Admin nicht sicherstellen:', err.message);
    }
}

/**
 * Registriert einen neuen Benutzer und vergibt Punkte für die Registrierung.
 * @async
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} Ergebnisobjekt mit `success` und ggf. `user` oder `error`.
 */
async function registerUser(username, email, password) {
    await ensureRoles();

    if (!username || !email) return { success: false, error: 'Benutzername und E-Mail sind erforderlich' };
    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim();

    // Prüfe E-Mail (case-insensitive)
    const existingEmail = await db.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)', [cleanEmail]);
    if (existingEmail.length > 0) return { success: false, error: 'E-Mail bereits registriert' };

    // Prüfe Benutzernamen (case-insensitive) damit sich Namen nicht nur durch Groß-/Kleinschreibung unterscheiden
    const existingUsername = await db.query('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername]);
    if (existingUsername.length > 0) return { success: false, error: 'Benutzername bereits vergeben' };

    const hash = await hashService.hash(password);

    // Standard-Rollen-ID dynamisch abrufen (z.B. 'Mitarbeiter')
        const roleRows = await db.query('SELECT role_id FROM roles WHERE name = ?', ['Mitarbeiter']);
    const defaultRole = roleRows.length ? roleRows[0].role_id : 3;

        const insertRes = await db.query(
            'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
            [cleanUsername, cleanEmail, hash, defaultRole]
        );

    const newUserId = insertRes?.insertId;
    if (!newUserId) return { success: false, error: 'Fehler bei der Registrierung' };

    await pointsService.addPendingDelta({
        userId: Number(newUserId),
        delta: pointsService.POINT_VALUES.USER_REGISTRATION,
        reason: 'user_registration'
    });

    const roleMap = { 1: 'Admin', 2: 'Projektleiter', 3: 'Mitarbeiter' };
    const roleName = roleMap[defaultRole] || 'Mitarbeiter';

    return {
        success: true,
        user: {
            id: Number(newUserId),
            username,
            role: roleName
        }
    };
}

/**
 * Authentifiziert einen Benutzer anhand E-Mail und Passwort.
 * @async
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} Objekt mit `success` und `user` oder `error`.
 */
async function authenticateUser(email, password) {
    const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return { success: false, error: 'Konto nicht gefunden' };

    const user = rows[0];
    const match = await hashService.verify(password, user.password_hash);
    if (!match) return { success: false, error: 'Falsches Passwort' };

    const roleRows = await db.query('SELECT name FROM roles WHERE role_id = ?', [user.role_id]);
    const roleName = roleRows[0]?.name || 'Mitarbeiter';

    let usesDefaultPassword = false;
    if (INITIAL_ADMIN_PASSWORD_GENERATED && DEFAULT_ADMIN_PASSWORD) {
        usesDefaultPassword = await hashService.verify(DEFAULT_ADMIN_PASSWORD, user.password_hash);
    }

    return {
        success: true,
        user: {
            id: Number(user.user_id),
            username: user.username,
            role: roleName,
            email: user.email,
            usesDefaultPassword
        }
    };
}

/**
 * Prüft, ob ein Admin-Flag für das Passwort gesetzt ist.
 * @async
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function checkAdminFlag(userId) {
    try {
        const rowsFlag = await db.query('SELECT user_id FROM admin_password_flags WHERE user_id = ?', [userId]);
        return rowsFlag && rowsFlag.length > 0;
    } catch (e) {
        return false;
    }
}

/**
 * Ändert das Passwort eines Users nach Verifizierung des aktuellen Passworts.
 * @async
 * @param {number} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<Object>} `{ success: true }` oder `{ success: false, error }`.
 */
async function changePassword(userId, currentPassword, newPassword) {
    const rows = await db.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
    if (!rows.length) return { success: false, error: 'User nicht gefunden' };

    const { password_hash } = rows[0];
    const valid = await hashService.verify(currentPassword, password_hash);
    if (!valid) return { success: false, error: 'Aktuelles Passwort ist falsch' };

    const hash = await hashService.hash(newPassword);
        await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, userId]);

    return { success: true };
}

/**
 * Kennzeichnet einen Benutzer, dass er das Admin-Passwort-Flag gesetzt hat.
 * @async
 * @param {number} userId
 * @returns {Promise<void>}
 */
async function setAdminFlag(userId) {
    await db.query('INSERT IGNORE INTO admin_password_flags (user_id) VALUES (?)', [userId]);
}

/**
 * Setzt das Passwort eines Benutzers direkt (ohne altes Passwort).
 * @async
 * @param {number} userId
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
async function resetPassword(userId, newPassword) {
    const hash = await hashService.hash(newPassword);
        await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hash, userId]);
}

module.exports = {
    hashService,
    ensureRoles,
    ensureDefaultAdmin,
    registerUser,
    authenticateUser,
    checkAdminFlag,
    setAdminFlag,
    changePassword,
    resetPassword,
    get DEFAULT_ADMIN_PASSWORD() { return DEFAULT_ADMIN_PASSWORD; },
    get INITIAL_ADMIN_PASSWORD_GENERATED() { return INITIAL_ADMIN_PASSWORD_GENERATED; }
};

