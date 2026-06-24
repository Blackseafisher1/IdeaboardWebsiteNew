-- name: list-projects
SELECT p.*, u.username AS author_username
FROM projects p
JOIN users u ON u.user_id = p.user_id
ORDER BY p.created_at DESC;
