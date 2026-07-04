/**
 * @fileoverview Anreicherungs-Utilities für Ideen: Batch-Laden von Tags, Dateien, Reaktionen und Live-Counters.
 * Vermeidet N+1-Abfragen durch Sammelabfragen.
 * @module lib/services/ideasEnrichmentService
 */
const db = require('../../config/db.js');

/**
 * Lädt Tags, Dateien und Nutzer-Reaktionen für eine Menge von Ideen (Batch).
 * @async
 * @param {Array<Object>} paginatedIdeas - Array mit Ideen-Objekten (muss `idea_id` enthalten).
 * @param {number} userId - Aktuelle Nutzer-ID (zur Erkennung eigener Likes/Dislikes).
 * @returns {Promise<Array<Object>>} Angereicherte Ideen-Objekte.
 */
async function enrichIdeasBatch(paginatedIdeas, userId) {
  if (!paginatedIdeas || paginatedIdeas.length === 0) return [];

  // IDs der sichtbaren Ideen extrahieren (für Batch-Abfragen)
  const visibleIds = paginatedIdeas.map(i => i.idea_id);
  const likesSet = new Set();
  const dislikesSet = new Set();
  const tagsMap = new Map();
  const filesMap = new Map();

  // Lade Live-Zähler aus der primären `ideas`-Tabelle, damit Statistiken sofort aktuell sind
  const liveCountsRows = await db.query(
    'SELECT idea_id, like_count, dislike_count, comment_count FROM ideas WHERE idea_id IN (?)',
    [visibleIds]
  );
  const liveCountsMap = new Map();
  for (const r of liveCountsRows) liveCountsMap.set(r.idea_id, r);

  const [tagsRows, filesRows, likedRows, dislikedRows] = await Promise.all([
    db.query(`-- sql
      SELECT l.idea_id, t.name
      FROM idea_tag_links l
      JOIN idea_tags t ON t.tag_id = l.tag_id
      WHERE l.idea_id IN (?)
    `, [visibleIds]),
    db.query(`-- sql
      SELECT file_id, idea_id, file_path, original_name
      FROM idea_files
      WHERE idea_id IN (?)
      ORDER BY uploaded_at DESC
    `, [visibleIds]),
    db.query('SELECT idea_id FROM likes WHERE user_id = ? AND idea_id IN (?)', [userId, visibleIds]),
    db.query('SELECT idea_id FROM dislikes WHERE user_id = ? AND idea_id IN (?)', [userId, visibleIds])
  ]);

  // Mappe die geladenen Tags pro Idee (idea_id -> [tagNames])
  tagsRows.forEach(row => {
    if (!tagsMap.has(row.idea_id)) tagsMap.set(row.idea_id, []);
    tagsMap.get(row.idea_id).push(row.name);
  });
  // Mappe die geladenen Dateien pro Idee (idea_id -> [fileObjs])
  filesRows.forEach(f => {
    if (!filesMap.has(f.idea_id)) filesMap.set(f.idea_id, []);
    filesMap.get(f.idea_id).push(f);
  });
  // Markiere Ideen, die vom aktuellen Nutzer geliked/disliked wurden
  likedRows.forEach(r => likesSet.add(r.idea_id));
  dislikedRows.forEach(r => dislikesSet.add(r.idea_id));

  // Baue die finalen angereicherten Idea-Objekte
  return paginatedIdeas.map(idea => {
    const live = liveCountsMap.get(idea.idea_id) || {};
    idea.like_count = Number(live.like_count ?? idea.like_count ?? 0) || 0;
    idea.dislike_count = Number(live.dislike_count ?? idea.dislike_count ?? 0) || 0;
    idea.comment_count = Number(live.comment_count ?? idea.comment_count ?? 0) || 0;
    idea.likes_count = idea.like_count;
    idea.dislikes_count = idea.dislike_count;
    idea.comments_count = idea.comment_count;
    idea.tags = tagsMap.get(idea.idea_id) || [];
    idea.files = filesMap.get(idea.idea_id) || [];
    idea.userLiked = likesSet.has(idea.idea_id);
    idea.userDisliked = dislikesSet.has(idea.idea_id);
    idea.isOwner = String(idea.user_id) === String(userId);
    idea.comments = [];
    return idea;
  });
}

/**
 * Normalisiert das Autoren-Feld: Wenn `author_username` vorliegt, kopiere es auf `author`.
 * @param {Array<Object>|Object|null} rows
 * @returns {Array<Object>|Object|null}
 */
function normalizeAuthor(rows) {
  if (!rows) return rows;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (r && r.author_username !== undefined) {
        r.author = r.author_username;
        delete r.author_username;
      }
    }
    return rows;
  }
  if (rows.author_username !== undefined) {
    rows.author = rows.author_username;
    delete rows.author_username;
  }
  return rows;
}

module.exports = {
  enrichIdeasBatch,
  normalizeAuthor
};


