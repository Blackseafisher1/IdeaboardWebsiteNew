-- name: dashboard_metrics
SELECT
  (SELECT COUNT(*) FROM ideas WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_ideas,
  (SELECT COUNT(*) FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_users,
  (SELECT COUNT(*) FROM ideas) AS total_ideas,
  (SELECT COUNT(*) FROM users) AS total_users;

-- name: top_ideas
SELECT i.*, u.username AS author_username,
  (i.like_count - i.dislike_count) AS score
FROM ideas i
JOIN users u ON u.user_id = i.user_id
ORDER BY score DESC
LIMIT :limit;
