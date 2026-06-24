-- name: search_title
SELECT i.*, u.username AS author_username,
  MATCH(s.title) AGAINST(:query IN BOOLEAN MODE) AS relevance
FROM ideas_search s
JOIN ideas i ON i.idea_id = s.idea_id
JOIN users u ON u.user_id = i.user_id
WHERE MATCH(s.title) AGAINST(:query IN BOOLEAN MODE)
ORDER BY relevance DESC
LIMIT :limit OFFSET :offset;

-- name: search_title_count
SELECT COUNT(*) AS total
FROM ideas_search s
WHERE MATCH(s.title) AGAINST(:query IN BOOLEAN MODE);

-- name: search_description
SELECT i.*, u.username AS author_username
FROM ideas_search s
JOIN ideas i ON i.idea_id = s.idea_id
JOIN users u ON u.user_id = i.user_id
WHERE MATCH(s.description) AGAINST(:query IN BOOLEAN MODE)
   OR s.tags LIKE CONCAT('%', :query, '%')
ORDER BY i.created_at DESC
LIMIT :limit OFFSET :offset;

-- name: search_description_count
SELECT COUNT(*) AS total
FROM ideas_search s
WHERE MATCH(s.description) AGAINST(:query IN BOOLEAN MODE)
   OR s.tags LIKE CONCAT('%', :query, '%');

-- name: search_author_like
SELECT i.*, u.username AS author_username
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE u.username LIKE CONCAT(:query, '%')
   OR i.title LIKE CONCAT(:query, '%')
   OR i.title = :query_exact
ORDER BY CASE WHEN i.title = :query_exact THEN 0 ELSE 1 END,
  i.created_at DESC
LIMIT :limit OFFSET :offset;

-- name: search_author_like_count
SELECT COUNT(*) AS total
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE u.username LIKE CONCAT(:query, '%')
   OR i.title LIKE CONCAT(:query, '%')
   OR i.title = :query_exact;
