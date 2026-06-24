-- name: list_ideas
-- List ideas with optional filters, paginated
SELECT i.*, u.username AS author_username
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE (COALESCE(:category_id, 0) = 0 OR i.category_id = :category_id)
  AND (:owned_only = 0 OR i.user_id = :user_id)
ORDER BY CASE :sort
  WHEN 'oldest' THEN i.created_at END ASC,
  i.created_at DESC
LIMIT :limit OFFSET :offset;

-- name: count_ideas
SELECT COUNT(*) AS total
FROM ideas i
WHERE (COALESCE(:category_id, 0) = 0 OR i.category_id = :category_id)
  AND (:owned_only = 0 OR i.user_id = :user_id);

-- name: get_idea_by_id
SELECT i.*, u.username AS author_username
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE i.idea_id = :id;

-- name: create_idea
INSERT INTO ideas (user_id, title, description, category_id, status, created_at, updated_at)
VALUES (:user_id, :title, :description, :category_id, 'neu', NOW(), NOW());

-- name: update_idea
UPDATE ideas
SET title = :title, description = :description, category_id = :category_id, updated_at = NOW()
WHERE idea_id = :id AND user_id = :user_id;

-- name: delete_idea
DELETE FROM ideas WHERE idea_id = :id;

-- name: update_idea_status
UPDATE ideas SET status = :status, updated_at = NOW() WHERE idea_id = :id;

-- name: check_duplicate_idea
SELECT idea_id FROM ideas WHERE user_id = :user_id AND title = :title LIMIT 1;

-- name: check_owner
SELECT user_id FROM ideas WHERE idea_id = :id;
