defmodule IdeaBoard.AdminService do
  def get_dashboard(_user) do
    try do
      users = case IdeaBoard.Repo.query_maps("SELECT user_id, username, email, role_id, created_at FROM users ORDER BY created_at DESC") do
        {:ok, u} -> u || []
        _ -> []
      end
      ideas = case IdeaBoard.Repo.query_maps("SELECT idea_id, title, user_id, status, created_at FROM ideas ORDER BY created_at DESC") do
        {:ok, i} -> i || []
        _ -> []
      end
      %{users: users, ideas: ideas}
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> %{users: [], ideas: []}
    end
  end
end
