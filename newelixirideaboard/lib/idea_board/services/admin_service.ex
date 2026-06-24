defmodule IdeaBoard.AdminService do
  def get_dashboard(_user) do
    {:ok, u} = IdeaBoard.Repo.query("SELECT user_id, username, email, role_id, created_at FROM users ORDER BY created_at DESC")
    {:ok, i} = IdeaBoard.Repo.query("SELECT idea_id, title, user_id, status, created_at FROM ideas ORDER BY created_at DESC")
    %{users: u.rows || [], ideas: i.rows || []}
  end
end
