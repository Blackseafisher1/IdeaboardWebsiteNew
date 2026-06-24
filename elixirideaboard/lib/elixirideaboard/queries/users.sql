-- name: get_user
SELECT u.*, r.name AS role_name FROM users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.user_id = :id;

-- name: get_user_by_username
SELECT u.*, r.name AS role_name FROM users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.username = :username;

-- name: get_user_by_email
SELECT u.*, r.name AS role_name FROM users u
JOIN roles r ON r.role_id = u.role_id
WHERE u.email = :email;

-- name: create_user
INSERT INTO users (username, email, password_hash, role_id, created_at)
VALUES (:username, :email, :password_hash, :role_id, NOW());

-- name: update_user
UPDATE users SET email = :email, username = :username WHERE user_id = :id;

-- name: update_password
UPDATE users SET password_hash = :password_hash WHERE user_id = :id;

-- name: search_users
SELECT u.user_id, u.username, u.email FROM users u
WHERE u.username LIKE CONCAT(:query, '%')
   OR u.email LIKE CONCAT(:query, '%')
LIMIT :limit;

-- name: get_user_minimal
SELECT user_id, username FROM users WHERE user_id = :id;
