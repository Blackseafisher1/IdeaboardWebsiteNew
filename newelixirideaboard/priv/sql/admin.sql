-- name: list-users
SELECT user_id, username, email, role_id, created_at FROM users ORDER BY created_at DESC;

-- name: list-all-ideas
SELECT idea_id, title, user_id, status, created_at FROM ideas ORDER BY created_at DESC;
