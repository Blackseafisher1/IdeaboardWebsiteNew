-- name: list_users
SELECT u.user_id, u.username, u.email, u.role_id, r.name AS role_name, u.created_at, u.last_login_at
FROM users u
JOIN roles r ON r.role_id = u.role_id
ORDER BY u.created_at DESC;

-- name: get_user_stats
SELECT
  (SELECT COUNT(*) FROM ideas WHERE user_id = :user_id) AS idea_count,
  (SELECT COUNT(*) FROM idea_comments WHERE user_id = :user_id) AS comment_count;

-- name: update_user_role
UPDATE users SET role_id = :role_id WHERE user_id = :user_id;

-- name: delete_user
DELETE FROM users WHERE user_id = :user_id;
