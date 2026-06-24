-- name: get-dashboard-stats
SELECT
  (SELECT COUNT(*) FROM ideas) AS total_ideas,
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM ideas WHERE user_id = :user_id) AS my_ideas,
  (SELECT IFNULL(SUM(current_points), 0) FROM user_points WHERE user_id = :user_id) AS my_points;
