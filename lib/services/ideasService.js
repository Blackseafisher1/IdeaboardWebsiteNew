/**
 * @fileoverview Kern-Service für Ideen: Erstellen, Lesen, Aktualisieren und Löschen
 * sowie Hilfsfunktionen für Rendering, Suche und Uploads.
 * Alle JSDoc-Kommentare sind auf Deutsch.
 * @module lib/services/ideasService
 */

const db = require('../../config/db.js');
const { executeWithRetry } = require('../dbHelpers');
const { enrichIdeasBatch, normalizeAuthor } = require('./ideasEnrichmentService');
const { loadCommentsWithReactions } = require('./ideasCommentsService');
const { getWeeklyRemaining } = require('./ideasStatsService');
const categoriesService = require('./categoriesService');
const pointsService = require('./pointsService');
const tagsService = require('./ideasTagsService');
const { isAdmin: hasAdminRole } = require('../roleHelpers');

/**
 * Legt eine neue Idee an, verwaltet Tags und optionale Datei-Uploads
 * und vergibt dafür Punkte (Pending-Delta).
 * @async
 * @param {number|string} userId - Erstellender Benutzer.
 * @param {object} data - Idee-Daten (`title`, `description`, `category_id`, `tags`).
 * @param {object|null} file - Optionaler Dateiupload-Metadatensatz.
 * @returns {Promise<number>} Die neu erzeugte `idea_id`.
 */
async function createIdea(userId, data, file) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const result = await conn.query(
      'INSERT INTO ideas (user_id, category_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [userId, data.category_id, data.title, data.description]
    );
    const ideaId = result.insertId;

    // Tags verarbeiten (Liste parsen, trimmen, leere Einträge entfernen, kleinschreiben)
    const ideasFilesService = require('./ideasFilesService'); // Lazy load to avoid circular deps
    const tagList = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(t => t.toLowerCase());
    const uniqueTags = [...new Set(tagList)];
    await tagsService.addTags(ideaId, uniqueTags, conn);

    // Datei verarbeiten
    let hasFile = false;
    if (file) {
      hasFile = await ideasFilesService.saveIdeaFile(ideaId, file, conn);
    }

    // Punktevergabe
    await pointsService.awardIdeaCreated(userId, ideaId, uniqueTags.length, hasFile, conn);

    await conn.commit();
    return ideaId;
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Löscht eine Idee und revidiert zugehörige Punkte (als Pending-Delta).
 * Führt Berechtigungsprüfungen durch (Autor oder Admin).
 * @async
 * @param {number|string} ideaId - ID der zu löschenden Idee.
 * @param {number|string} userId - Anfragender Benutzer.
 * @param {string} userRole - Rolle des anfragenden Benutzers.
 * @returns {Promise<object>} Ergebnisobjekt mit `success` oder `error`.
 */
async function deleteIdea(ideaId, userId, userRole) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const idea = (await conn.query(
      'SELECT user_id, status, created_at, tag_count, file_count, IFNULL(like_count,0) AS like_count, IFNULL(dislike_count,0) AS dislike_count FROM ideas WHERE idea_id = ? FOR UPDATE',
      [ideaId]
    ))[0];
    
    if (!idea) {
      await conn.rollback();
      return { success: false, error: 'Idee nicht gefunden' };
    }

    const isAuthor = String(idea.user_id) === String(userId);
    const isAdmin = hasAdminRole(userRole);
    if (!isAuthor && !isAdmin) {
      await conn.rollback();
      return { success: false, error: 'Nicht berechtigt' };
    }

    // Punkte zurücknehmen
    let totalDelta = -5; // Basis-Rücknahme
    const AUTO_REVERT_HOURS = 24;
    const createdAt = new Date(idea.created_at);
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    // Spezialfall: In Prüfung / Akzeptiert und vom Autor selbst gelöscht (Behinderung der Admins)
    if (isAuthor && !isAdmin && (idea.status === 'in prüfung' || idea.status === 'akzeptiert')) {
      totalDelta = -15; // Höhere Strafe für Abbruch während der Bearbeitungsphase
    } 
    else if (idea.status === 'neu' && ageHours <= AUTO_REVERT_HOURS && Number(idea.like_count) === 0 && Number(idea.dislike_count) === 0) {
      totalDelta -= (Number(idea.tag_count) || 0);
      totalDelta -= (Number(idea.file_count) || 0);
    }

    if (totalDelta !== 0) {
      await pointsService.addPendingDelta({
        userId: idea.user_id,
        delta: totalDelta,
        reason: 'idea_deleted',
        source: ideaId,
        conn
      });
    }

    await conn.query('DELETE FROM ideas WHERE idea_id = ?', [ideaId]);

    await conn.commit();
    return { success: true };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

const { addPendingDelta, POINT_VALUES } = require('./pointsService');
const { getIdeaTags, addTags, removeTag } = require('./ideasTagsService');

/**
 * Aktualisiert Titel, Beschreibung und Kategorie einer Idee.
 * Prüft Besitzerrechte oder Admin-Privilegien.
 * @async
 * @param {number|string} ideaId
 * @param {number|string} userId
 * @param {object} data
 * @param {string} userRole
 * @returns {Promise<object>} Ergebnisobjekt mit `success` oder `error`.
 */
async function updateIdea(ideaId, userId, data, userRole) {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [idea] = await conn.query(
      'SELECT user_id FROM ideas WHERE idea_id = ? FOR UPDATE',
      [ideaId]);

    if (!idea) {
      return { success: false, error: 'Idee nicht gefunden' };
    }

    const isOwner = String(idea.user_id) === String(userId);
    const isAdmin = hasAdminRole(userRole);

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Nicht berechtigt' };
    }

    await conn.query(
      'UPDATE ideas SET title = ?, description = ?, category_id = ?, updated_at = NOW() WHERE idea_id = ?',
      [data.title, data.description, data.category_id, ideaId]
    );

    await conn.commit();
    return { success: true };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Fügt einer Idee Tags hinzu (vereinheitlicht, dedupliziert) und vergibt
 * bei Bedarf Punkte für Engagement.
 * @async
 * @param {number|string} ideaId
 * @param {number|string} userId
 * @param {string} tagsInput - Kommagetrennte Tag-Liste.
 * @returns {Promise<object>} Ergebnisobjekt mit `success`.
 */
async function addIdeaTags(ideaId, userId, tagsInput) {
  const tagList = (tagsInput || '')
    .split(',')
    // Entferne Whitespace um Tags und ignoriere leere Einträge
    .map(t => t.trim())
    .filter(Boolean)
    // Vereinheitliche auf Kleinbuchstaben
    .map(t => t.toLowerCase());
  const uniqueTags = [...new Set(tagList)];

  if (uniqueTags.length === 0) return { success: true };

  const currentTags = await getIdeaTags(ideaId);
  // Bestimme die neu hinzuzufügenden Tags (Unique minus bereits vorhandene)
  const toAdd = uniqueTags.filter(n => !currentTags.includes(n));

  if (toAdd.length === 0) return { success: true };

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    await addTags(ideaId, toAdd, conn);

    // Award 1 point for adding tags (engagement)
    await addPendingDelta({
      userId,
      delta: 1,
      reason: 'tags_added',
      source: ideaId
    }, conn);

    await conn.commit();
    return { success: true };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Entfernt ein einzelnes Tag von einer Idee (Berechtigungsprüfung wird durchgeführt).
 * @async
 * @param {number|string} ideaId
 * @param {number|string} userId
 * @param {string} userRole
 * @param {string} tagName
 * @returns {Promise<object>} Ergebnisobjekt mit `success` oder `error`.
 */
async function removeIdeaTag(ideaId, userId, userRole, tagName) {
  const ideaRows = await db.query('SELECT user_id FROM ideas WHERE idea_id = ?', [ideaId]);
  const idea = ideaRows[0];
  if (!idea) return { success: false, error: 'Idee nicht gefunden' };

  if (String(idea.user_id) !== String(userId) && userRole !== 'Admin') {
    return { success: false, error: 'Nicht berechtigt' };
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    await removeTag(ideaId, tagName, conn);

    await conn.commit();
    return { success: true };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Prüft, ob ein ähnlicher Titel vom gleichen Benutzer in den letzten Sekunden erstellt wurde.
 * Nützlich zur Vermeidung doppelter Einreichungen bei Netzwerk-Resubmits.
 * @async
 * @param {number|string} userId
 * @param {string} title
 * @returns {Promise<number|null>} `idea_id` bei Duplikat sonst `null`.
 */
async function checkDuplicateIdea(userId, title) {
  const recent = await db.query(
    'SELECT idea_id FROM ideas WHERE user_id = ? AND title = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 SECOND) ORDER BY created_at DESC LIMIT 1',
    [userId, title]
  );
  return (recent && recent.length > 0) ? recent[0].idea_id : null;
}

/**
 * Admin-Funktion zum Setzen des Idea-Status.
 * @async
 * @param {number|string} ideaId
 * @param {string} status
 * @param {number|string} userId
 * @param {string} userRole
 * @returns {Promise<object>} Ergebnisobjekt mit `success` oder `error`.
 */
async function updateIdeaStatus(ideaId, status, userId, userRole) {
  if (userRole !== 'Admin') return { success: false, error: 'Nur Admins können den Status ändern' };

  // Load current status to enforce rules (prevent manual setting to 'umgesetzt' and
  // prevent any changes once status is already 'umgesetzt')
  const ideaRows = await db.query('SELECT user_id, status FROM ideas WHERE idea_id = ? FOR UPDATE', [ideaId]);
  const idea = ideaRows[0];
  if (!idea) return { success: false, error: 'Idee nicht gefunden' };

  const currentStatus = (idea.status || '').toLowerCase();
  const requestedStatus = String(status || '').toLowerCase();

  if (currentStatus === 'umgesetzt') {
    return { success: false, error: 'Statusänderung nicht erlaubt: Idee ist bereits umgesetzt' };
  }

  if (requestedStatus === 'umgesetzt') {
    return { success: false, error: 'Manuelles Setzen des Status "Umgesetzt" ist nicht erlaubt' };
  }

  await executeWithRetry(db, 'UPDATE ideas SET status = ?, updated_at = NOW() WHERE idea_id = ?', [status, ideaId]);
  return { success: true };
}

/**
 * Lädt eine Datei zu einer bestehenden Idee hoch und vergibt ggf. Punkte.
 * Die eigentliche Speicherung wird vom `ideasFilesService` übernommen.
 * @async
 * @param {number|string} ideaId
 * @param {number|string} userId
 * @param {object} file
 * @returns {Promise<boolean>} `true` bei Erfolg.
 */
async function uploadIdeaFile(ideaId, userId, file) {
  const ideasFilesService = require('./ideasFilesService');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const saved = await ideasFilesService.saveIdeaFile(ideaId, file, conn);
    if (saved) {
      await pointsService.addPendingDelta({
        userId,
        delta: pointsService.POINT_VALUES.IDEA_FILE_BONUS,
        reason: 'file_uploaded',
        source: ideaId,
        conn
      });
    }

    await conn.commit();
    return saved;
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

const { 
  SORT_WHITELIST, 
  MAX_INNER_LIMIT,
  buildBaseFilters, 
  buildBooleanQuery,
  executeFulltextSearch,
  lookupExactTitleIdeaId,
  ensureExactOnTop,
  normalizeSort
} = require('./ideasSearchService');

/**
 * Utility: Liest den ersten Wert einer möglicherweise mehrfach übergebenen
 * Query-Parameter-Variable (z.B. `q` kann als Array oder Einzelwert vorliegen).
 * @param {any} val - Einzelwert oder Array (z.B. aus `req.query`).
 * @param {any} [fallback] - Rückfallwert, falls `val` leer oder undefined ist.
 * @returns {any} Der erste gefundene Wert oder `fallback`.
 */
function firstQueryValue(val, fallback) {
  if (Array.isArray(val)) return val[0] ?? fallback;
  return (val ?? fallback);
}

/**
 * Bereitet Daten für die Anzeige einer Idea-Card vor. Fügt Reaktionen,
 * Tags, Dateien und Kommentare hinzu und berechnet verbleibende Quoten.
 * @async
 * @param {number|string} ideaId
 * @param {number|string|null} userId
 * @param {Array|null} categories
 * @returns {Promise<object|null>} Zusammengesetzte Card-Daten oder `null` bei Fehler.
 */
async function renderIdeaCard(ideaId, userId, categories) {
  try {
    const rows = await db.query(
      'SELECT i.*, u.username AS author_username FROM ideas i LEFT JOIN users u ON u.user_id = i.user_id WHERE i.idea_id = ?',
      [ideaId]
    );
    const ideas = rows;
    if (!ideas || !ideas.length) return null;

    normalizeAuthor(ideas);
    const enriched = await enrichIdeasBatch(ideas, userId);
    const idea = enriched[0];
    if (!idea) {
      console.warn(`[renderIdeaCard] Idee ${ideaId} gefunden, Anreicherung fehlgeschlagen (size=${ideas.length})`);
      return null;
    }

    const { comments } = await loadCommentsWithReactions(ideaId, userId);
    idea.comments = comments;

    let remainingLikes = 0;
    let remainingDislikes = 0;
    if (userId) {
      const stats = await getWeeklyRemaining(userId);
      remainingLikes = stats.remainingLikes;
      remainingDislikes = stats.remainingDislikes;
    }

    return {
      idea,
      categories,
      user: userId ? {
        id: userId,
        remainingLikes,
        remainingDislikes,
        isOwner: idea.isOwner
      } : null
    };
  } catch (err) {
    console.error('Error in renderIdeaCard helper:', err);
    return null;
  }
}

/**
 * Liefert eine Seite von Ideen mit Suche, Filterung und Sortierung.
 * Unterstützt Fulltext- sowie Title/Author-Suchen und Paging.
 * @async
 * @param {number|string|null} userId - Optionaler Benutzerkontext.
 * @param {object} query - Query-Parameter (`q`, `tags`, `category_id`, `page`, `limit`, `sort`, ...).
 * @returns {Promise<object>} Objekt mit `ideas`, `categories`, `user` und `pagination`.
 */
async function fetchIdeas(userId, query = {}) {
  const qRaw = String(firstQueryValue(query.q, ''));
  const qTrim = qRaw.trim();
  const qNorm = qRaw.replace(/\s+/g, ' ');
  const isSearch = (qNorm.length > 0);
  const tagsRaw = firstQueryValue(query.tags, '');
  const category_id = firstQueryValue(query.category_id, '');
  const owned_only = firstQueryValue(query.owned_only, 'false');
  const page = parseInt(firstQueryValue(query.page, '1'), 10) || 1;
  const limit = parseInt(firstQueryValue(query.limit, '50'), 10) || 50;
  const offset = (page - 1) * limit;

  let sort = normalizeSort(firstQueryValue(query.sort, 'latest'));
  if (query.global === 'on') {
    sort = normalizeSort('all_' + sort.replace('all_', ''));
  } else {
    sort = normalizeSort(sort.replace('all_', ''));
  }

  const categories = await categoriesService.getAll();
  const { baseWhere, baseParams, categoryIdNum } = buildBaseFilters(category_id, tagsRaw, userId, owned_only === 'true');

  let innerWhereSql = '';
  if (Number.isInteger(categoryIdNum) && !sort.startsWith('all_') && owned_only !== 'true') {
    innerWhereSql = `WHERE category_id = ${categoryIdNum}`;
  } else if (owned_only === 'true' && userId && !sort.startsWith('all_')) {
    innerWhereSql = `WHERE user_id = ${userId}` + (Number.isInteger(categoryIdNum) ? ` AND category_id = ${categoryIdNum}` : '');
  }

  const fromSql = (sort.startsWith('all_') || !isSearch) 
    ? 'FROM ideas i' 
    : `FROM (SELECT * FROM ideas i ${innerWhereSql} ORDER BY ${SORT_WHITELIST[sort].sql} LIMIT ${MAX_INNER_LIMIT}) i`;
  
  const whereSql = baseWhere.length > 0 ? ` WHERE ${baseWhere.join(' AND ')}` : '';

  let paginatedIdeas = [];
  let totalCount = 0;
  let hasNextPage = false;
  let searchResults = null;
  let cachedExactIdeaId = null;
  let searchEngine = null;

  if (isSearch) {
    const scopeRaw = firstQueryValue(query.search_scope, '').toLowerCase();
    const desc_only = (scopeRaw === 'desc' || scopeRaw === 'description');
    const booleanQuery = buildBooleanQuery(qNorm);

    // Use SQL fulltext search for title/author and description
    searchResults = await executeFulltextSearch(qNorm, booleanQuery, whereSql, baseParams, limit, offset, desc_only, firstQueryValue(query.debug_search, '') === '1');
    paginatedIdeas = searchResults.results || [];
    totalCount = searchResults.total || 0;
    hasNextPage = (offset + limit) < totalCount;
    searchEngine = 'fulltext';
  } else {
    const countSql = `SELECT COUNT(*) as total ${fromSql} ${whereSql}`;
    totalCount = await db.query(countSql, baseParams)[0]?.total || 0;
    const finalSql = `SELECT i.*, u.username AS author_username ${fromSql} JOIN users u ON u.user_id = i.user_id ${whereSql} ORDER BY ${SORT_WHITELIST[sort].sql} LIMIT ? OFFSET ?`;
    paginatedIdeas = await db.query(finalSql, [...baseParams, limit, offset]);
    normalizeAuthor(paginatedIdeas);
    hasNextPage = (offset + limit) < totalCount;
  }

  const enriched = await enrichIdeasBatch(paginatedIdeas, userId);

  if (firstQueryValue(query.global, '') === 'on' && isSearch) {
    if (!cachedExactIdeaId) {
      try { cachedExactIdeaId = await lookupExactTitleIdeaId(db, qNorm); } catch (e) {}
    }
    if (cachedExactIdeaId) {
      try { await ensureExactOnTop(enriched, cachedExactIdeaId, limit); } catch (e) {}
    }
  }

  const { remainingLikes, remainingDislikes } = await getWeeklyRemaining(userId);

  return {
    ideas: enriched,
    categories,
    user: {
      remainingLikes,
      remainingDislikes
    },
    pagination: {
      page,
      totalCount,
      hasNextPage,
      limit
    },
    search: isSearch ? { q: qNorm, engine: searchEngine, ...searchResults } : null,
    filters: {
      q: qNorm,
      category_id,
      tags: tagsRaw,
      owned_only,
      sort
    }
  };
}

module.exports = {
  renderIdeaCard,
  fetchIdeas,
  createIdea,
  deleteIdea,
  updateIdea,
  addIdeaTags,
  removeIdeaTag,
  checkDuplicateIdea,
  updateIdeaStatus,
  uploadIdeaFile
};


