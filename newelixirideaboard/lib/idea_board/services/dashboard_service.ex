defmodule IdeaBoard.DashboardService do
  def get_stats(user) do
    try do
      case IdeaBoard.Repo.query_map(
             "SELECT (SELECT COUNT(*) FROM ideas) AS total_ideas, (SELECT COUNT(*) FROM users) AS total_users, (SELECT COUNT(*) FROM ideas WHERE user_id = ?) AS my_ideas, (SELECT IFNULL(SUM(current_points), 0) FROM user_points WHERE user_id = ?) AS my_points",
             [user.user_id, user.user_id]
           ) do
        {:ok, map} -> map || %{total_ideas: 0, total_users: 0, my_ideas: 0, my_points: 0}
        _ -> %{total_ideas: 0, total_users: 0, my_ideas: 0, my_points: 0}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> %{total_ideas: 0, total_users: 0, my_ideas: 0, my_points: 0}
    end
  end
end
