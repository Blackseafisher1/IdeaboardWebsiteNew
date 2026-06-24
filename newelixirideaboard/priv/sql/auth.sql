-- name: find-user-by-email
SELECT * FROM users WHERE LOWER(email) = LOWER(:email);

-- name: create-user
INSERT INTO users (username, email, password_hash, role_id) VALUES (:username, :email, :password_hash, :role_id);
