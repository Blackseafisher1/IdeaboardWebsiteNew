defmodule IdeaBoard.IdeasStatsService do
  def get_stats(idea_id) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT IFNULL(like_count, 0) AS like_count, IFNULL(dislike_count, 0) AS dislike_count, IFNULL(comment_count, 0) AS comment_count, score FROM ideas WHERE idea_id = ?",
      [idea_id]
    )
    result.rows[0]
  end

  def get_weekly_remaining(user_id) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT COUNT(*) AS count FROM ideas WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
      [user_id]
    )
    result.rows[0] && result.rows[0][0] || 0
  end
end
