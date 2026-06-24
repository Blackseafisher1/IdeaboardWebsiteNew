-- name: award-points
INSERT INTO user_points_log (user_id, points, reason, reference_id, created_at) VALUES (:user_id, :points, :reason, :reference_id, NOW());

-- name: deduct-points
INSERT INTO user_points_log (user_id, points, reason, reference_id, created_at) VALUES (:user_id, -:points, :reason, :reference_id, NOW());
