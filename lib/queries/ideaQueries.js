/**
 * @fileoverview SQL-Statements für Idea-Abfragen und Enrichment.
 * @module lib/queries/ideaQueries
 */
const SEARCH_IDEAS_BASE = `
SELECT i.*, u.username as author_username,
       (SELECT COUNT(*) FROM comment_likes WHERE idea_id = i.idea_id) as total_interactions
FROM ideas i
JOIN users u ON i.user_id = u.user_id
`;

const ENRICH_IDEAS_TAGS = `
SELECT it.idea_id, t.name as tag_name
FROM idea_tags it
JOIN tags t ON it.tag_id = t.tag_id
WHERE it.idea_id IN (?)
`;

const ENRICH_IDEAS_FILES = `
SELECT idea_id, filename, original_name, mimetype
FROM idea_files
WHERE idea_id IN (?)
`;

module.exports = {
  SEARCH_IDEAS_BASE,
  ENRICH_IDEAS_TAGS,
  ENRICH_IDEAS_FILES
};
