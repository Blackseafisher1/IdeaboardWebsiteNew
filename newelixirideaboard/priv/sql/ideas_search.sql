-- name: search-by-title
SELECT i.*, u.username AS author_username,
  MATCH(s.title) AGAINST(:query IN BOOLEAN MODE) AS relevance
FROM ideas_search s
JOIN ideas i ON i.idea_id = s.idea_id
JOIN users u ON u.user_id = i.user_id
WHERE MATCH(s.title) AGAINST(:query IN BOOLEAN MODE)
ORDER BY relevance DESC
LIMIT :limit OFFSET :offset;

-- name: search-by-description
SELECT i.*, u.username AS author_username
FROM ideas_search s
JOIN ideas i ON i.idea_id = s.idea_id
JOIN users u ON u.user_id = i.user_id
WHERE MATCH(s.description) AGAINST(:query IN BOOLEAN MODE)
OR s.tags LIKE CONCAT('%', :query, '%')
ORDER BY i.created_at DESC
LIMIT :limit OFFSET :offset;
