/**
 * @fileoverview Hilfsfunktionen für Statistik-Abfragen (z.B. Wochenquoten für Likes/Dislikes).
 * JSDoc in diesem Projekt ist auf Deutsch verfasst.
 * @module lib/services/ideasStatsService
 */

const db = require('../../config/db.js');

async function getWeeklyRemaining(userId) {
  const weeklyLikeRows = await db.query(
    'SELECT COUNT(*) AS cnt FROM likes WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
    [userId]
  );
  const weeklyLikes = weeklyLikeRows[0]?.cnt;

  const weeklyDislikeRows = await db.query(
    'SELECT COUNT(*) AS cnt FROM dislikes WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)',
    [userId]
  );
  const weeklyDislikes = weeklyDislikeRows[0]?.cnt;

  return {
    remainingLikes: Math.max(0, 3 - (Number(weeklyLikes) || 0)),
    remainingDislikes: Math.max(0, 3 - (Number(weeklyDislikes) || 0))
  };
}

module.exports = {
  getWeeklyRemaining
};


