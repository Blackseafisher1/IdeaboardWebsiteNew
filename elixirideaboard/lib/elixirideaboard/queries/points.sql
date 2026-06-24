-- name: get_points
SELECT points FROM user_points WHERE user_id = :user_id;

-- name: add_points
INSERT INTO user_points (user_id, points, updated_at)
VALUES (:user_id, :points, NOW())
ON DUPLICATE KEY UPDATE points = points + :points, updated_at = NOW();

-- name: deduct_points
UPDATE user_points SET points = GREATEST(0, points - :points), updated_at = NOW()
WHERE user_id = :user_id;
