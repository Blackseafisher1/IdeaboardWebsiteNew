-- name: weekly_remaining
SELECT remaining_likes, remaining_dislikes
FROM weekly_stats
WHERE user_id = :user_id AND week_start = :week_start;
