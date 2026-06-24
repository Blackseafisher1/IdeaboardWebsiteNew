-- name: list-comments
SELECT c.*, u.username AS author_username
FROM idea_comments c
JOIN users u ON u.user_id = c.user_id
WHERE c.idea_id = :idea_id
ORDER BY c.created_at ASC;

-- name: create-comment
INSERT INTO idea_comments (idea_id, user_id, text, created_at) VALUES (:idea_id, :user_id, :text, NOW());

-- name: latest-comment
SELECT c.*, u.username AS author_username
FROM idea_comments c
JOIN users u ON u.user_id = c.user_id
WHERE c.idea_id = :idea_id
ORDER BY c.created_at DESC
LIMIT 1;

-- name: get-comment
SELECT * FROM idea_comments WHERE comment_id = :comment_id;

-- name: delete-comment
DELETE FROM idea_comments WHERE comment_id = :comment_id;
