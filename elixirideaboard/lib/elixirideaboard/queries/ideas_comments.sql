-- name: list_comments
SELECT c.*, u.username AS author_username
FROM idea_comments c
JOIN users u ON u.user_id = c.user_id
WHERE c.idea_id = :idea_id
ORDER BY c.created_at ASC;

-- name: create_comment
INSERT INTO idea_comments (idea_id, user_id, text, created_at, updated_at)
VALUES (:idea_id, :user_id, :text, NOW(), NOW());

-- name: update_comment
UPDATE idea_comments SET text = :text, updated_at = NOW()
WHERE comment_id = :id AND user_id = :user_id;

-- name: delete_comment
DELETE FROM idea_comments WHERE comment_id = :id;

-- name: get_comment_by_id
SELECT c.*, u.username AS author_username
FROM idea_comments c
JOIN users u ON u.user_id = c.user_id
WHERE c.comment_id = :id;
