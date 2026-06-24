-- name: get-user
SELECT * FROM users WHERE user_id = :user_id;

-- name: update-user
UPDATE users SET username = :username, email = :email WHERE user_id = :user_id;

-- name: find-user-by-email
SELECT * FROM users WHERE LOWER(email) = LOWER(:email);
