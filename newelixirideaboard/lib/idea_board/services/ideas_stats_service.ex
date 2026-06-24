defmodule IdeaBoard.IdeasStatsService do
  def get_stats(idea_id) do
    try do
      case IdeaBoard.Repo.query_map(
             "SELECT IFNULL(like_count, 0) AS like_count, IFNULL(dislike_count, 0) AS dislike_count, IFNULL(comment_count, 0) AS comment_count, score, idea_id FROM ideas WHERE idea_id = ?",
             [idea_id]
           ) do
        {:ok, map} -> map || %{like_count: 0, dislike_count: 0, comment_count: 0, score: 0, idea_id: idea_id}
        _ -> %{like_count: 0, dislike_count: 0, comment_count: 0, score: 0, idea_id: idea_id}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> %{like_count: 0, dislike_count: 0, comment_count: 0, score: 0, idea_id: idea_id}
    end
  end

  def get_weekly_remaining(user_id) do
    try do
      case IdeaBoard.Repo.query_map(
             "SELECT COUNT(*) AS count FROM ideas WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
             [user_id]
           ) do
        {:ok, map} -> (map && map[:count]) || 0
        _ -> 0
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> 0
    end
  end
end
