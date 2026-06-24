/**
 * @fileoverview Service für die Suche von Ideen (SQL & Fulltext-Strategien).
 *
 * Enthält Hilfsfunktionen zur Normalisierung von Suchparametern,
 * Aufbau von WHERE-Klauseln und die Ausführung von Fulltext- sowie
 * Title/Author-Suchen mit Late-Row-Lookup zur Begrenzung von JOINs.
 * Alle Beschreibungen auf Deutsch.
 * @module lib/services/ideasSearchService
 */

const db = require('../../config/db.js');
const { normalizeAuthor } = require('./ideasEnrichmentService');

// --- Konfiguration & Konstanten ---
const MAX_INNER_LIMIT = 1000;


const SORT_WHITELIST = {
  latest:       { sql: 'i.created_at DESC, i.idea_id DESC', label: 'Latest' },
  all_latest:   { sql: 'i.created_at DESC, i.idea_id DESC', label: 'All (Latest)' },
  oldest:       { sql: 'i.created_at ASC, i.idea_id ASC', label: 'Oldest' },
  all_oldest:   { sql: 'i.created_at ASC, i.idea_id ASC', label: 'All (Oldest)' },
  likes:        { sql: 'i.like_count DESC, i.created_at DESC, i.idea_id DESC', label: 'Likes' },
  all_likes:    { sql: 'i.like_count DESC, i.created_at DESC, i.idea_id DESC', label: 'All (Likes)' },
  dislikes:     { sql: 'i.dislike_count DESC, i.created_at DESC, i.idea_id DESC', label: 'Dislikes' },
  all_dislikes: { sql: 'i.dislike_count DESC, i.created_at DESC, i.idea_id DESC', label: 'All (Dislikes)' },
  comments:     { sql: 'i.comment_count DESC, i.created_at DESC, i.idea_id DESC', label: 'Comments' },
  all_comments: { sql: 'i.comment_count DESC, i.created_at DESC, i.idea_id DESC', label: 'All (Comments)' },
  score:        { sql: 'i.created_at DESC, i.idea_id DESC', label: 'Score (Global only)' },
  all_score:    { sql: 'i.created_at DESC, i.idea_id DESC', label: 'All (Score)' },
};

/**
 * Validiert und normalisiert den Sortier-Schlüssel gegen die Whitelist.
 * Wenn ungültig, wird `latest` zurückgegeben.
 * @param {string} sortKey - Angefragter Sortierschlüssel.
 * @returns {string} Validierter Sortierschlüssel.
 */
function normalizeSort(sortKey) {
  return SORT_WHITELIST[sortKey] ? sortKey : 'latest';
}

/**
 * Parst eine durch Komma getrennte Tag-Eingabe in eine normalisierte Liste.
 * Führt Trim und Lowercase durch und entfernt leere Einträge.
 * @param {string|string[]|undefined} tagsRaw - Rohwert aus Query/Request.
 * @returns {string[]} Normalisierte Tag-Liste.
 */
function parseTagsInput(tagsRaw) {
  return String(tagsRaw || '')
    .split(',')
    // Normalize: trim + lowercase
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Versucht, die `idea_id` für einen exakt übereinstimmenden Titel zu finden.
 * Probiert verschiedene Kollationen und LIKE-Fälle als Fallbacks.
 * @async
 * @param {object} conn - DB-Verbindungsobjekt (z.B. `db` oder Connection).
 * @param {string} title - Gesuchter Titel.
 * @returns {Promise<number|null>} Gefundene `idea_id` oder `null`.
 */
async function lookupExactTitleIdeaId(conn, title) {
  if (!title) return null;
  try {
    const rows = await conn.query('SELECT idea_id FROM ideas_search WHERE title = ? LIMIT 1', [title]);
    if (rows && rows[0] && rows[0].idea_id) return rows[0].idea_id;
  } catch (e) {}
  try {
    const rows = await conn.query('SELECT idea_id FROM ideas_search WHERE title COLLATE utf8mb4_general_ci = ? LIMIT 1', [title]);
    if (rows && rows[0] && rows[0].idea_id) return rows[0].idea_id;
  } catch (e) {}
  try {
    const rows = await conn.query('SELECT idea_id FROM ideas_search WHERE title LIKE ? LIMIT 1', [title]);
    if (rows && rows[0] && rows[0].idea_id) return rows[0].idea_id;
  } catch (e) {}
  return null;
}

/**
 * Falls eine exakte Treffer-ID vorhanden ist, stellt diese sicher, dass
 * sie am Anfang des Ergebnis-Arrays steht. Falls nicht vorhanden, wird
 * der vollständige Datensatz nachgeladen und vorne eingefügt (bis Limit).
 * @async
 * @param {Array<object>} resultsArray - Ergebnis-Array (wird in-place verändert).
 * @param {number|string|null} exactId - Erwartete `idea_id`.
 * @param {number} limit - Maximale Anzahl der zurückzugebenden Ergebnisse.
 * @returns {Promise<number>} `1` wenn ein Datensatz neu eingefügt wurde, sonst `0`.
 */
async function ensureExactOnTop(resultsArray, exactId, limit) {
  if (!exactId) return 0;
  if (!Array.isArray(resultsArray)) return 0;
  try {
    // Wenn die genaue ID bereits im Ergebnis vorkommt, nach vorne rotieren.
    const idx = resultsArray.findIndex(r => Number(r.idea_id) === Number(exactId));
    if (idx > 0) {
      const [itm] = resultsArray.splice(idx, 1);
      resultsArray.unshift(itm);
      return 0;
    }
    if (idx === -1) {
      const fullRows = await db.query(
        'SELECT i.*, u.username AS author_username FROM ideas i JOIN users u ON u.user_id = i.user_id WHERE i.idea_id = ?',
        [exactId]);
      if (fullRows && fullRows[0]) {
        normalizeAuthor(fullRows);
        resultsArray.unshift(fullRows[0]);
        if (resultsArray.length > limit) resultsArray.pop();
        return 1;
      }
    }
  } catch (e) {}
  return 0;
}

/**
 * Baut Basis-WHERE-Klauseln für Kategorie- und Tag-Filter auf.
 * Gibt `baseWhere` (Array von SQL-Teilstrings), `baseParams` und die
 * analysierten `tagList` zurück.
 * @param {string|number|undefined} categoryId - Optionaler Kategorie-Filter.
 * @param {string|undefined} tagsRaw - Roh-Tag-String (kommagetrennt).
 * @returns {{baseWhere:string[],baseParams:Array,categoryIdNum:number,tagList:string[]}}
 */
function buildBaseFilters(categoryId, tagsRaw, userId = null, ownedOnly = false) {
  const baseWhere = [];
  const baseParams = [];
  const categoryIdNum = parseInt(categoryId, 10);

  if (Number.isInteger(categoryIdNum)) {
    baseWhere.push('i.category_id = ?');
    baseParams.push(categoryIdNum);
  }

  if (ownedOnly && userId) {
    baseWhere.push('i.user_id = ?');
    baseParams.push(userId);
  }

  const inputTags = parseTagsInput(tagsRaw);
  if (inputTags.length > 0) {
    // Baue Platzhalter-Liste für IN(...) und ergänze WHERE-Existenz-Subquery
    const placeholders = inputTags.map(() => '?').join(', ');
    baseWhere.push(`
      EXISTS (
        SELECT 1
        FROM idea_tag_links l
        JOIN idea_tags t ON t.tag_id = l.tag_id
        WHERE l.idea_id = i.idea_id
          AND t.name IN (${placeholders})
      )
    `);
    baseParams.push(...inputTags);
  }

  return { baseWhere, baseParams, categoryIdNum, tagList: inputTags };
}

/**
 * Erzeugt eine boolean-mode kompatible Query-Zeichenkette für Fulltext-Suchen.
 * Wandelt Eingabe-Tokens in Wildcard-Ausdrücke (z.B. `wort*`) um.
 * @param {string} rawQ - Rohsuchtext.
 * @returns {string} Boolean-Mode Query-String.
 */
function buildBooleanQuery(rawQ) {
  if (!rawQ) return '';
  const parts = [];
  const tokens = String(rawQ).split(/[\s,.;:!?|/-]+/);
  for (let t of tokens) {
    t = t.trim();
    if (!t) continue;
    // Remove the mandatory '+' to allow partial matches (e.g. if one word has a typo)
    if (t.length > 2) {
      parts.push(`${t}*`);
    } else {
      parts.push(`${t}`);
    }
  }
  return parts.join(' ');
}

/**
 * Führt die Fulltext- oder Title/Author-Suche aus und nutzt Late-Row-Lookup
 * um erst IDs zu ermitteln und anschließend die vollständigen Zeilen zu JOINen.
 * Unterstützt einen Description-only Modus sowie differenzierte Scoring-Fälle.
 * @async
 * @param {string} q - Rohsuchtext.
 * @param {string} booleanQuery - Vorbereitete boolean-mode Query (optional).
 * @param {string} whereSql - Optionales WHERE-Fragment zur Einschränkung.
 * @param {Array} baseParams - Parameter für `whereSql`.
 * @param {number} limit - LIMIT für Ergebnisse.
 * @param {number} offset - OFFSET für Ergebnisse.
 * @param {boolean|string} [descriptionMode=true] - `true|'desc_only'` für Beschreibungssuche.
 * @param {boolean} [debug=false] - Debug-Flag (derzeit nicht prominent genutzt).
 * @param {string} [sortKey=''] - Gewünschter Sortierschlüssel (Whitelist-Validierung extern).
 * @returns {Promise.<Object>} Suchergebnisse und Gesamtanzahl.
 */
async function executeFulltextSearch(q, booleanQuery, whereSql, baseParams, limit, offset, descriptionMode = true, debug = false, sortKey = '') {
  const raw = String(q ?? '');
  const qTrim = raw.trim();
  const qNorm = qTrim.replace(/\s+/g, ' ');

  if (!qTrim) {
    return { results: [], total: 0 };
  }

  // If description-only mode, use description FULLTEXT
  if (descriptionMode === 'desc_only' || descriptionMode === true) {
    try {
      const phraseCond = `(MATCH(s.description) AGAINST(? IN BOOLEAN MODE) OR s.tags LIKE CONCAT('%', ?, '%'))`;
      const whereClause = whereSql ? `${whereSql} AND ${phraseCond}` : `WHERE ${phraseCond}`;

      // Use Late Row Lookup for description search
      const listSql = `
        SELECT i.*, u.username AS author_username
        FROM (
          SELECT s.idea_id
          FROM ideas_search s
          JOIN ideas i ON i.idea_id = s.idea_id
          ${whereClause}
          ORDER BY i.created_at DESC
          LIMIT ? OFFSET ?
        ) AS top
        JOIN ideas i ON i.idea_id = top.idea_id
        JOIN users u ON u.user_id = i.user_id
        ORDER BY i.created_at DESC
      `;
      const rows = await db.query(listSql, [...(baseParams || []), qNorm, qNorm, Number(limit) || 0, Number(offset) || 0]);
      normalizeAuthor(rows);

      const countSql = `SELECT COUNT(*) AS total FROM ideas_search s JOIN ideas i ON i.idea_id = s.idea_id ${whereClause}`;
      const countRows = await db.query(countSql, [...(baseParams || []), qNorm, qNorm]);
      const total = countRows[0]?.total || 0;
      return { results: rows, total };
    } catch (e) {
      return { results: [], total: 0 };
    }
  }

  // Default: title + author SQL search
  try {
    const titleBool = buildBooleanQuery(qNorm);
    const searchCond = `(MATCH(s.title) AGAINST(? IN BOOLEAN MODE) OR s.title = ? OR s.title LIKE CONCAT(?, '%') OR s.author LIKE CONCAT(?, '%'))`;
    const whereClause = whereSql ? `${whereSql} AND ${searchCond}` : `WHERE ${searchCond}`;

    // Use Late Row Lookup: Search IDs first to avoid joining thousands of rows before LIMIT
    const listSql = `
      SELECT i.*, u.username AS author_username,
             top.title_match_score, top.title_exact_boost, top.title_prefix_boost, top.author_prefix_boost
      FROM (
        SELECT s.idea_id,
          (MATCH(s.title) AGAINST(? IN BOOLEAN MODE)) AS title_match_score,
          (CASE WHEN s.title = ? THEN 1000000 ELSE 0 END) AS title_exact_boost,
          (CASE WHEN s.title LIKE CONCAT(?, '%') THEN 50000 ELSE 0 END) AS title_prefix_boost,
          (CASE WHEN s.author LIKE CONCAT(?, '%') THEN 1000 ELSE 0 END) AS author_prefix_boost
        FROM ideas_search s
        JOIN ideas i ON i.idea_id = s.idea_id
        ${whereClause}
        ORDER BY (title_exact_boost + title_prefix_boost + title_match_score * 1000 + author_prefix_boost) DESC
        LIMIT ? OFFSET ?
      ) AS top
      JOIN ideas i ON i.idea_id = top.idea_id
      JOIN users u ON u.user_id = i.user_id
      ORDER BY (top.title_exact_boost + top.title_prefix_boost + top.title_match_score * 1000 + top.author_prefix_boost) DESC
    `;
    const params = [
      titleBool, qNorm, qNorm, qNorm, // For SELECT scoring columns
      ...(baseParams || []),         // For whereSql (e.g. category_id)
      titleBool, qNorm, qNorm, qNorm, // For searchCond in whereClause
      Number(limit) || 0, Number(offset) || 0
    ];
    const rows = await db.query(listSql, params);
    normalizeAuthor(rows);

    const countSql = `SELECT COUNT(*) AS total FROM ideas_search s JOIN ideas i ON i.idea_id = s.idea_id ${whereClause}`;
    const countParams = [...(baseParams || []), titleBool, qNorm, qNorm, qNorm];
    const countRows = await db.query(countSql, countParams);
    const total = countRows[0]?.total || 0;
    return { results: rows, total };
  } catch (e) {
    return { results: [], total: 0 };
  }
}



module.exports = {
  SORT_WHITELIST,
  MAX_INNER_LIMIT,
  normalizeSort,
  parseTagsInput,
  buildBaseFilters,
  buildBooleanQuery,
  executeFulltextSearch,
  lookupExactTitleIdeaId,
  ensureExactOnTop
};


