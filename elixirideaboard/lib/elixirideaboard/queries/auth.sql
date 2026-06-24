-- name: login_query
SELECT u.*, r.name AS role_name FROM users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.username = :username OR u.email = :email LIMIT 1;

-- name: set_session
UPDATE users SET last_login_at = NOW() WHERE user_id = :id;

-- name: ensure_default_admin
SELECT user_id FROM users WHERE role_id = 1 LIMIT 1;

-- name: create_default_admin
INSERT INTO users (username, email, password_hash, role_id, created_at)
VALUES ('admin', 'admin@ideaboard.local', :password_hash, 1, NOW());
