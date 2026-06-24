const db = require('../../config/db.js');
const { executeWithRetry } = require('../dbHelpers');
const pointsService = require('./pointsService');
const { getWeeklyRemaining } = require('./ideasStatsService');

/**
 * @fileoverview Service für Reaktionen (Likes/Dislikes) auf Ideen.
 * Beinhaltet Transaktionslogik, Punktevergabe und Quotenprüfung.
 * Alle JSDoc-Kommentare in Deutsch.
 * @module lib/services/reactionsService
 */

/**
 * Schaltet ein Like für eine Idee durch einen Benutzer um (Toggle).
 * Führt notwendige DB-Operationen in einer Transaktion aus, aktualisiert
 * Zähler und vergibt bzw. korrigiert Punkte für den Autor.
 * @async
 * @param {number|string} ideaId - ID der Idee.
 * @param {number|string} userId - ID des ausführenden Benutzers.
 * @returns {Promise.<Object>}
 */
async function toggleIdeaLike(ideaId, userId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const res1 = await conn.query('SELECT COUNT(*) AS cnt FROM likes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
    const alreadyLiked = Number(res1[0]?.cnt || 0);

    let liked = false;
    if (alreadyLiked > 0) {
      await conn.query('DELETE FROM likes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
      await executeWithRetry(conn, 'UPDATE ideas SET like_count = GREATEST(like_count - 1, 0), updated_at = NOW() WHERE idea_id = ?', [ideaId]);
      
      const ownerRes = await conn.query('SELECT user_id FROM ideas WHERE idea_id = ?', [ideaId]);
      const ownerRow = ownerRes[0];
      if (ownerRow && ownerRow.user_id !== userId) {
        await pointsService.addPendingDelta({
          userId: ownerRow.user_id,
          delta: -5,
          reason: 'idea_unliked',
          source: ideaId,
          conn
        });
      }
      liked = false;
    } else {
      // Check weekly quota
      const stats = await getWeeklyRemaining(userId);
      if (stats.remainingLikes <= 0) {
        await conn.rollback();
        return { success: false, error: 'Like-Limit erreicht (3 pro Woche)' };
      }

      // Prüfe auf gegenteilige Reaktion (Dislike) und entferne sie, falls vorhanden
      const res4 = await conn.query('SELECT COUNT(*) AS cnt FROM dislikes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
      const hadDislike = Number(res4[0]?.cnt || 0);

      if (hadDislike > 0) {
        await conn.query('DELETE FROM dislikes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
        await executeWithRetry(conn, 'UPDATE ideas SET dislike_count = GREATEST(dislike_count - 1, 0), updated_at = NOW() WHERE idea_id = ?', [ideaId]);
        // Erstatte dem Autor den Punkt, der durch das Dislike verloren ging
        const ownerRes2 = await conn.query('SELECT user_id FROM ideas WHERE idea_id = ?', [ideaId]);
        const ownerRow = ownerRes2[0];
        if (ownerRow && ownerRow.user_id !== userId) {
          await pointsService.addPendingDelta({
            userId: ownerRow.user_id,
            delta: 1, // Erstatte die Dislike-Strafe
            reason: 'idea_undisliked',
            source: ideaId,
            conn
          });
        }
      }

      await conn.query('INSERT INTO likes (idea_id, user_id, created_at) VALUES (?, ?, NOW())', [ideaId, userId]);
      await executeWithRetry(conn, 'UPDATE ideas SET like_count = like_count + 1, updated_at = NOW() WHERE idea_id = ?', [ideaId]);
      
      const ownerRes3 = await conn.query('SELECT user_id FROM ideas WHERE idea_id = ?', [ideaId]);
      const ownerRow = ownerRes3[0];
      if (ownerRow && ownerRow.user_id !== userId) {
        await pointsService.addPendingDelta({
          userId: ownerRow.user_id,
          delta: pointsService.POINT_VALUES.IDEA_LIKED_BONUS,
          reason: 'idea_liked',
          source: ideaId,
          conn
        });
      }
      liked = true;
    }

    await conn.commit();
    return { success: true, liked };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Schaltet ein Dislike für eine Idee um (Toggle) unter Berücksichtigung
 * von Wochenquoten. Entfernt ggf. gegenteilige Reaktionen und passt Punkte an.
 * @async
 * @param {number|string} ideaId - ID der Idee.
 * @param {number|string} userId - ID des ausführenden Benutzers.
 * @returns {Promise.<Object>}
 */
async function toggleIdeaDislike(ideaId, userId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const res9 = await conn.query('SELECT COUNT(*) AS cnt FROM dislikes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
    const alreadyDisliked = Number(res9[0]?.cnt || 0);

    if (alreadyDisliked > 0) {
      await conn.query('DELETE FROM dislikes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
      await executeWithRetry(conn, 'UPDATE ideas SET dislike_count = GREATEST(dislike_count - 1, 0), updated_at = NOW() WHERE idea_id = ?', [ideaId]);
      
      const ownerRes4 = await conn.query('SELECT user_id FROM ideas WHERE idea_id = ?', [ideaId]);
      const ownerRow = ownerRes4[0];
      if (ownerRow && ownerRow.user_id !== userId) {
        await pointsService.addPendingDelta({
          userId: ownerRow.user_id,
          delta: 1, // Reward back the penalty
          reason: 'idea_undisliked',
          source: ideaId,
          conn
        });
      }
      await conn.commit();
      return { success: true, disliked: false };
    } else {
      // Prüfe Wochenquota
      const stats = await getWeeklyRemaining(userId);
      if (stats.remainingDislikes <= 0) {
        await conn.rollback();
        return { success: false, error: 'Dislike-Limit erreicht (3 pro Woche)' };
      }

      // Entferne gegenteiliges Like, falls vorhanden
      const res11 = await conn.query('SELECT COUNT(*) AS cnt FROM likes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
      const hadLike = Number(res11[0]?.cnt || 0);

      if (hadLike > 0) {
        await conn.query('DELETE FROM likes WHERE user_id = ? AND idea_id = ?', [userId, ideaId]);
        await executeWithRetry(conn, 'UPDATE ideas SET like_count = GREATEST(like_count - 1, 0), updated_at = NOW() WHERE idea_id = ?', [ideaId]);
      }

      await conn.query('INSERT INTO dislikes (idea_id, user_id, created_at) VALUES (?, ?, NOW())', [ideaId, userId]);
      await executeWithRetry(conn, 'UPDATE ideas SET dislike_count = dislike_count + 1, updated_at = NOW() WHERE idea_id = ?', [ideaId]);

      const ownerRes = await conn.query('SELECT user_id FROM ideas WHERE idea_id = ?', [ideaId]);
      const ownerRow = ownerRes[0];
      if (ownerRow && ownerRow.user_id !== userId) {
        await pointsService.addPendingDelta({
          userId: ownerRow.user_id,
          delta: pointsService.POINT_VALUES.IDEA_DISLIKED_PENALTY,
          reason: 'idea_disliked',
          source: ideaId,
          conn
        });
      }

      await conn.commit();
      return { success: true, disliked: true };
    }
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  toggleIdeaLike,
  toggleIdeaDislike
};

