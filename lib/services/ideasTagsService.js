/**
 * @fileoverview Service für Idea-Tags: Lesen, Hinzufügen und Entfernen von
 * Tags sowie Pflege der zugehörigen Zähler in den `ideas`-Einträgen.
 * JSDoc und Kommentare auf Deutsch.
 * @module lib/services/ideasTagsService
 */

const db = require('../../config/db.js');
const { executeWithRetry } = require('../dbHelpers');

/**
 * Liefert alle Tag-Namen für eine bestimmte Idee.
 * @async
 * @param {number|string} ideaId - ID der Idee.
 * @returns {Promise<string[]>} Array mit Tag-Namen.
 */
async function getIdeaTags(ideaId) {
  const rows = await db.query(
    'SELECT t.name FROM idea_tags t JOIN idea_tag_links l ON t.tag_id = l.tag_id WHERE l.idea_id = ?',
    [ideaId]);
  // Extrahiere nur die Tag-Namen aus den DB-Zeilen
  return rows.map(r => r.name);
}

/**
 * Fügt einer Idee Tags hinzu; erstellt Tags falls nötig und erhöht den Zähler.
 * @async
 * @param {number|string} ideaId - ID der Idee.
 * @param {string[]} tagNames - Liste der Tag-Namen.
 * @param {Object} [conn] - Optionale DB-Verbindung für Transaktionen.
 * @returns {Promise<number>} Anzahl neu verknüpfter Tags.
 */
async function addTags(ideaId, tagNames, conn = db) {
  let newlyLinkedCount = 0;
  // Vereinheitliche Tag-Namen: trim + lowercase + deduplizieren
  const uniqueTags = [...new Set(tagNames.map(t => t.trim().toLowerCase()).filter(Boolean))];
  
  for (const name of uniqueTags) {
    const tagRes = await conn.query(
      'INSERT INTO idea_tags (name) VALUES (?) ON DUPLICATE KEY UPDATE tag_id = LAST_INSERT_ID(tag_id)',
      [name]
    );
    const tagId = tagRes.insertId;
    const linkRes = await conn.query(
      'INSERT IGNORE INTO idea_tag_links (idea_id, tag_id) VALUES (?, ?)',
      [ideaId, tagId]
    );
    
    if (linkRes && linkRes.affectedRows > 0) {
      newlyLinkedCount++;
      await executeWithRetry(conn, 'UPDATE ideas SET tag_count = tag_count + 1, updated_at = NOW() WHERE idea_id = ?', [ideaId]);
    }
  }
  return newlyLinkedCount;
}

/**
 * Entfernt ein einzelnes Tag von einer Idee und dekrementiert den Zähler.
 * @async
 * @param {number|string} ideaId - ID der Idee.
 * @param {string} tagName - Zu entfernender Tag-Name.
 * @param {Object} [conn] - Optionale DB-Verbindung.
 * @returns {Promise<boolean>} `true`, wenn eine Verknüpfung entfernt wurde.
 */
async function removeTag(ideaId, tagName, conn = db) {
  const delRes = await conn.query(
    'DELETE l FROM idea_tag_links l JOIN idea_tags t ON t.tag_id = l.tag_id WHERE l.idea_id = ? AND t.name = ?',
    [ideaId, tagName.trim().toLowerCase()]
  );

  if (delRes && delRes.affectedRows > 0) {
    await executeWithRetry(conn, 'UPDATE ideas SET tag_count = GREATEST(tag_count - 1, 0), updated_at = NOW() WHERE idea_id = ?', [ideaId]);
    return true;
  }
  return false;
}

module.exports = {
  getIdeaTags,
  addTags,
  removeTag
};


