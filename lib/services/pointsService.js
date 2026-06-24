/**
 * @fileoverview Service zur Verwaltung von Punkteständen und Punktezuteilungen.
 * Enthält Konstanten für Punktwerte und Hilfsfunktionen zum Anlegen
 * und Aktualisieren von Pending-Deltas.
 * Alle JSDoc-Kommentare in diesem Projekt werden auf Deutsch gehalten.
 * @module lib/services/pointsService
 */

const db = require('../../config/db.js');

const POINT_VALUES = {
  IDEA_CREATED_BASE: 5,
  IDEA_TAG_BONUS: 1,      // per tag
  IDEA_FILE_BONUS: 1,
  IDEA_LIKED_BONUS: 5,
  IDEA_DISLIKED_PENALTY: -1,
  COMMENT_CREATED: 1,
  COMMENT_LIKED_BONUS: 1,
  SURVEY_CREATED_BASE: 5,
  SURVEY_PARTICIPATION: 3,
  SURVEY_AUTHOR_BONUS: 2, // per participant
  USER_REGISTRATION: 10
};

/**
 * Fügt einen ausstehenden Punkte-Delta für einen Benutzer hinzu.
 * Bewahrt das bestehende Verhalten: aktualisiert `user_points.pending_delta`.
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {number} opts.delta
 * @param {string|null} [opts.reason]
 * @param {string|null} [opts.source]
 * @param {Object|null} [opts.conn]
 */
async function addPendingDelta({ userId, delta, reason = null, source = null, conn = null }) {
  if (!userId || typeof delta !== 'number' || !Number.isFinite(delta)) {
    throw new Error('Invalid parameters for addPendingDelta');
  }

  // Bewahre das bisherige Verhalten: Upsert in `user_points` und Erhöhung von `pending_delta`
  const sql = 'INSERT INTO user_points (user_id, current_points, pending_delta) VALUES (?, 0, ?) ON DUPLICATE KEY UPDATE pending_delta = pending_delta + ?';
  const params = [userId, delta, delta];
  if (conn && typeof conn.query === 'function') {
    const stmt = await conn.prepare(sql);
    await stmt.execute(params);
    try { await stmt.close(); } catch (e) {}
  } else {
    await db.query(sql, params);
  }

  return true;
}

/**
 * Speziell: Berechnung der Punkte bei Erstellung einer Idee.
 */
async function awardIdeaCreated(userId, ideaId, tagsCount, hasFile, conn = null) {
  const delta = POINT_VALUES.IDEA_CREATED_BASE + 
                (tagsCount * POINT_VALUES.IDEA_TAG_BONUS) + 
                (hasFile ? POINT_VALUES.IDEA_FILE_BONUS : 0);
  
  return addPendingDelta({
    userId,
    delta,
    reason: 'idea_created',
    source: ideaId,
    conn
  });
}

module.exports = {
  POINT_VALUES,
  addPendingDelta,
  addPoints: addPendingDelta,
  awardIdeaCreated
};

