/**
 * @fileoverview Kommentar-Service für Ideen: Laden, Erstellen, Liken und Reaktionen.
 * @module lib/services/ideasCommentsService
 */
const db = require('../../config/db.js');
const pointsService = require('./pointsService');

/**
 * Lädt Kommentare zu einer Idee inklusive Top-Reaktionen und ob der Nutzer geliked hat.
 * @async
 * @param {number} ideaId
 * @param {number} userId
 * @returns {Promise.<Object>} 
 */
async function loadCommentsWithReactions(ideaId, userId) {
  const comments = await db.query(
    `SELECT c.*, u.username,
            CASE WHEN cl.user_id IS NULL THEN 0 ELSE 1 END AS user_liked
     FROM comments c
     JOIN users u ON u.user_id = c.user_id
     LEFT JOIN comment_likes cl
       ON cl.comment_id = c.comment_id AND cl.user_id = ?
     WHERE c.idea_id = ?
     ORDER BY c.created_at DESC`,
    [userId, ideaId]);

  const commentLikes = {};
  const commentIds = [];
  // Baue Grundstruktur für jeden Kommentar, markiere ob aktueller Nutzer geliked hat
  const enriched = comments.map(c => {
    const userLiked = Number(c.user_liked) > 0;
    if (userLiked) commentLikes[c.comment_id] = true;
    commentIds.push(c.comment_id);
    return { ...c, likes: c.like_count || 0, userLiked, user_id: c.user_id };
  });

  if (commentIds.length === 0) return { comments: enriched, commentLikes };

  const reactionAgg = await db.query(
    `SELECT comment_id, emoji, COUNT(*) AS cnt
     FROM comment_reactions
     WHERE comment_id IN (?)
     GROUP BY comment_id, emoji`,
    [commentIds]
  );

  const userReactions = await db.query(
    `SELECT comment_id, emoji
     FROM comment_reactions
     WHERE user_id = ? AND comment_id IN (?)`,
    [userId, commentIds]
  );

  const totals = new Map();   // comment_id -> total number
  const buckets = new Map();  // comment_id -> [{emoji,count}]
  for (const r of reactionAgg) {
    const cid = r.comment_id;
    const cnt = Number(r.cnt) || 0;

    totals.set(cid, (totals.get(cid) || 0) + cnt);

    if (!buckets.has(cid)) buckets.set(cid, []);
    buckets.get(cid).push({ emoji: r.emoji, count: cnt });
  }

  const userReactionMap = new Map();
  for (const r of userReactions) userReactionMap.set(r.comment_id, r.emoji);

  for (const c of enriched) {
    const list = (buckets.get(c.comment_id) || []).slice();
    // Sortiere Reaktionen nach Häufigkeit und lexikografisch bei Unentschieden
    list.sort((a, b) => (b.count - a.count) || a.emoji.localeCompare(b.emoji));
    c.topReactions = list.slice(0, 3);
    c.reactionsTotal = totals.get(c.comment_id) || 0;
    c.userReactionEmoji = userReactionMap.get(c.comment_id) || null;
  }

  return { comments: enriched, commentLikes };
}

/**
 * Lädt einen einzelnen Kommentar inklusive Reaktionen und Nutzerreaktion.
 * @async
 * @param {number} commentId
 * @param {number} userId
 * @returns {Promise.<Object>|null}
 */
async function loadSingleCommentWithReactions(commentId, userId) {
  const commentRows = await db.query(
    `SELECT c.*, u.username,
            (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.comment_id AND user_id = ?) AS user_liked
     FROM comments c
     JOIN users u ON u.user_id = c.user_id
     WHERE c.comment_id = ?
     LIMIT 1`,
    [userId, commentId]
  );
  const comment = commentRows[0];

  if (!comment) return null;

  const reactionAgg = await db.query(
    `SELECT emoji, COUNT(*) AS cnt
     FROM comment_reactions
     WHERE comment_id = ?
     GROUP BY emoji`,
    [commentId]
  );

  const userReactionRows = await db.query( 
    'SELECT emoji FROM comment_reactions WHERE user_id = ? AND comment_id = ? LIMIT 1',
    [userId, commentId]);
  const userReaction = userReactionRows[0];

  // Aggregat-Statistik: Gesamtanzahl Reaktionen und Top 3 Emojis
  const totals = reactionAgg.reduce((sum, r) => sum + (Number(r.cnt) || 0), 0);
  const topReactions = reactionAgg
    .map(r => ({ emoji: r.emoji, count: Number(r.cnt) || 0 }))
    .sort((a, b) => (b.count - a.count) || a.emoji.localeCompare(b.emoji))
    .slice(0, 3);

  const enriched = {
    ...comment,
    likes: comment.like_count || 0,
    userLiked: Number(comment.user_liked) > 0,
    reactionsTotal: totals,
    topReactions,
    userReactionEmoji: userReaction ? userReaction.emoji : null,
    user_id: comment.user_id
  };

  return {
    comment: enriched,
    commentLikes: enriched.userLiked ? { [comment.comment_id]: true } : {}
  };
}

/**
 * Erstellt einen neuen Kommentar und vergibt Punkte an den Autor.
 * @async
 * @param {number} ideaId
 * @param {number} userId
 * @param {string} text
 * @returns {Promise<number>} Neue Kommentar-ID
 * @throws {Error} Wenn Text fehlt oder zu lang ist.
 */
async function createComment(ideaId, userId, text) {
  const trimmed = (text || '').trim();
  if (!trimmed.length) throw new Error('Text fehlt');
  if (trimmed.length > 200) throw new Error('Kommentar zu lang');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const commentInsert = await conn.query(
      'INSERT INTO comments (idea_id, user_id, text, like_count, created_at) VALUES (?, ?, ?, 0, NOW())',
      [ideaId, userId, trimmed]
    );
    const commentId = commentInsert.insertId;

    await conn.query('UPDATE ideas SET comment_count = comment_count + 1, updated_at = NOW() WHERE idea_id = ?', [ideaId]);

    // Vergabe eines Punkts für das Erstellen eines Kommentars
    await pointsService.addPendingDelta({ 
      userId, 
      delta: pointsService.POINT_VALUES.COMMENT_CREATED, 
      reason: 'comment-create', 
      source: 'ideasCommentsService', 
      conn 
    });

    await conn.commit();
    return commentId;
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Toggles like für einen Kommentar; passt Zähler an und vergibt/entzieht Punkte.
 * @async
 * @param {number} commentId
 * @param {number} userId
 * @returns {Promise<boolean>} `true` wenn jetzt geliked.
 */
async function toggleCommentLike(commentId, userId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const rows = await conn.query(
      'SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]);

    const liked = rows.length === 0;
    if (!liked) {
      await conn.query('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
      await conn.query('UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE comment_id = ?', [commentId]);
      
      const commentOwnerRows = await conn.query('SELECT user_id FROM comments WHERE comment_id = ?', [commentId]);
      const commentOwner = commentOwnerRows[0];
      if (commentOwner) {
        await pointsService.addPendingDelta({ 
          userId: commentOwner.user_id, 
          delta: -pointsService.POINT_VALUES.COMMENT_LIKED_BONUS, 
          reason: 'comment-like-removed', 
          source: 'ideasCommentsService', 
          conn 
        });
      }
    } else {
      await conn.query('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [commentId, userId]);
      await conn.query('UPDATE comments SET like_count = like_count + 1 WHERE comment_id = ?', [commentId]);
      
      const commentOwnerRows2 = await conn.query('SELECT user_id FROM comments WHERE comment_id = ?', [commentId]);
      const commentOwner2 = commentOwnerRows2[0];
      if (commentOwner2) {
        await pointsService.addPendingDelta({ 
          userId: commentOwner2.user_id, 
          delta: pointsService.POINT_VALUES.COMMENT_LIKED_BONUS, 
          reason: 'comment-like-added', 
          source: 'ideasCommentsService', 
          conn 
        });
      }
    }

    await conn.commit();
    return liked;
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Fügt eine Reaktion (Emoji) zu einem Kommentar hinzu oder entfernt sie.
 * @async
 * @param {number} commentId
 * @param {number} userId
 * @param {string} emoji
 * @returns {Promise.<Object>}
 */
async function toggleCommentReaction(commentId, userId, emoji) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const existingRows = await conn.query(
      'SELECT emoji FROM comment_reactions WHERE comment_id = ? AND user_id = ?',
      [commentId, userId]);
    const existing = existingRows[0];

    let removed = false;
    let addedEmoji = null;

    if (existing) {
      await conn.query('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
      removed = true;
      if (existing.emoji !== emoji) {
        await conn.query('INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)', [commentId, userId, emoji]);
        addedEmoji = emoji;
        removed = false;
      }
    } else {
      await conn.query('INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)', [commentId, userId, emoji]);
      addedEmoji = emoji;
    }

    await conn.commit();
    return { removed, addedEmoji };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  loadCommentsWithReactions,
  loadSingleCommentWithReactions,
  createComment,
  toggleCommentLike,
  toggleCommentReaction
};


