-- name: list-ideas
SELECT i.*, u.username AS author_username
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE (:category_id IS NULL OR i.category_id = :category_id)
ORDER BY
  CASE WHEN :sort_order = 'DESC' THEN i.created_at END DESC,
  CASE WHEN :sort_order = 'ASC' THEN i.created_at END ASC,
  CASE WHEN :sort_order = 'likes' THEN i.like_count END DESC,
  CASE WHEN :sort_order = 'score' THEN i.score END DESC
LIMIT :limit OFFSET :offset;

-- name: fetch-idea
SELECT i.*, u.username AS author_username
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE i.idea_id = :idea_id;

-- name: update-idea
UPDATE ideas SET title = :title, description = :description, category_id = :category_id, status = :status, updated_at = NOW() WHERE idea_id = :idea_id;

-- name: delete-idea
DELETE FROM ideas WHERE idea_id = :idea_id;
