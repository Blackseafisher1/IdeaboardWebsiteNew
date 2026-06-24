/**
 * @fileoverview Benutzerdefinierter MariaDB-Session-Store kompatibel mit `express-session`.
 * Implementiert typische Store-Methoden (`get`, `set`, `destroy`, `touch`, `cleanup`, `close`).
 * @module lib/mariadb-session-store
 */
const session = require('express-session');
const db = require('../config/db');

class MariaDBStore extends session.Store {
  /**
   * @param {Object} options
   * @param {string} [options.table='sessions'] - Table name for sessions.
   * @param {number} [options.cleanupInterval=3600000] - Interval in ms to delete expired sessions (default 1h).
   */
  constructor(options = {}) {
    super();
    this.table = options.table || 'sessions';
    this.cleanupInterval = options.cleanupInterval !== undefined ? options.cleanupInterval : 60 * 60 * 1000;
    
    if (this.cleanupInterval > 0) {
      this._cleanupTimer = setInterval(() => {
        this.cleanup().catch(err => console.error('Session cleanup error:', err));
      }, this.cleanupInterval);
      if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }
  }

  /**
   * Liefert eine Session anhand der Session-ID.
   * @param {string} sid - Session-ID.
   * @param {function} cb - Callback (err, session).
   */
  async get(sid, cb) {
    try {
      // Verwende `query()`; diese Methode liefert bereits normalisierte Zeilen zurück
      const rows = await db.query(`SELECT sess, expires FROM \`${this.table}\` WHERE sid = ?`, [sid]);
      const row = Array.isArray(rows) ? rows[0] : rows;

      if (!row) {
        return cb(null, null);
      }

      // Ablaufdatum prüfen
      const expires = row.expires ? new Date(row.expires) : null;
      if (expires && expires < new Date()) {
        await this.destroy(sid, () => {});
        return cb(null, null);
      }

      // Session-Daten parsen. MariaDB liefert JSON als Objekt, wenn der Treiber
      // dies unterstützt; wir behandeln Strings zusätzlich für den Fall, dass
      // die Daten als TEXT gespeichert wurden.
      let sess = row.sess;
      if (typeof sess === 'string') {
        try {
          sess = JSON.parse(sess);
        } catch (e) {
          return cb(new Error('Failed to parse session JSON'));
        }
      }

      return cb(null, sess);
    } catch (err) {
      return cb(err);
    }
  }

  /**
   * Legt eine Session an oder aktualisiert sie (Upsert).
   * @param {string} sid - Session-ID.
   * @param {Object} sessionObj - Session-Daten.
   * @param {function} cb - Callback (err).
   */
  async set(sid, sessionObj, cb) {
    try {
      let expires = null;
      if (sessionObj && sessionObj.cookie) {
        if (sessionObj.cookie.expires) {
          expires = new Date(sessionObj.cookie.expires);
        } else if (typeof sessionObj.cookie.maxAge === 'number') {
          expires = new Date(Date.now() + sessionObj.cookie.maxAge);
        }
      }

      // Standard-Fallback (z. B. 1 Tag, falls nicht angegeben)
      if (!expires) {
        expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const sessJson = JSON.stringify(sessionObj);

      // MariaDB 10.2+ unterstützt `ON DUPLICATE KEY UPDATE`
      console.log('SESSION STORE: set called for', sid);
      await db.execute(
        `INSERT INTO \`${this.table}\` (sid, sess, expires) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE sess = VALUES(sess), expires = VALUES(expires)`,
        [sid, sessJson, expires]
      );

      console.log('SESSION STORE: set completed for', sid, '; calling cb');
      if (cb) cb(null);
    } catch (err) {
      console.log('SESSION STORE: set error for', sid, err && err.message ? err.message : err);
      if (cb) cb(err);
    }
  }

  /**
   * Löscht eine Session.
   * @param {string} sid - Session-ID.
   * @param {function} cb - Callback (err).
   */
  async destroy(sid, cb) {
    try {
      await db.execute(`DELETE FROM \`${this.table}\` WHERE sid = ?`, [sid]);
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  /**
   * Aktualisiert die Ablaufzeit einer Session (Touch).
   * @param {string} sid - Session-ID.
   * @param {Object} sessionObj - Session-Daten.
   * @param {function} cb - Callback (err).
   */
  async touch(sid, sessionObj, cb) {
    try {
      let expires = null;
      if (sessionObj && sessionObj.cookie) {
        if (sessionObj.cookie.expires) {
          expires = new Date(sessionObj.cookie.expires);
        } else if (typeof sessionObj.cookie.maxAge === 'number') {
          expires = new Date(Date.now() + sessionObj.cookie.maxAge);
        }
      }

      if (!expires) {
        expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      await db.execute(`UPDATE \`${this.table}\` SET expires = ? WHERE sid = ?`, [expires, sid]);
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  /**
   * Löscht abgelaufene Sessions aus der Datenbank.
   */
  async cleanup() {
    try {
      await db.execute(`DELETE FROM \`${this.table}\` WHERE expires < ?`, [new Date()]);
    } catch (err) {
      // logged by caller or timer
      throw err;
    }
  }

  /**
   * Stoppt den Aufräum-Timer.
   */
  close() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }
  }
}

module.exports = MariaDBStore;
