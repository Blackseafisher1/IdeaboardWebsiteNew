defmodule IdeaBoard.AdminService do
  def get_dashboard(_user) do
    try do
      {:ok, users} = IdeaBoard.Repo.query_maps("SELECT user_id, username, email, role_id, created_at FROM users ORDER BY created_at DESC")
      {:ok, ideas} = IdeaBoard.Repo.query_maps("SELECT idea_id, title, user_id, status, created_at FROM ideas ORDER BY created_at DESC")
      %{users: users || [], ideas: ideas || []}
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> %{users: [], ideas: []}
    end
  end
end
