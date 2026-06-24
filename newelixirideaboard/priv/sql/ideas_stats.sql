-- name: get-idea-stats
SELECT i.idea_id,
  IFNULL(i.like_count, 0) AS like_count,
  IFNULL(i.dislike_count, 0) AS dislike_count,
  IFNULL(i.comment_count, 0) AS comment_count,
  i.score
FROM ideas i WHERE i.idea_id = :idea_id;

-- name: get-weekly-count
SELECT COUNT(*) AS count FROM ideas WHERE user_id = :user_id AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY);
