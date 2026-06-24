defmodule IdeaBoard.UserService do
  def get(user_id) do
    {:ok, result} = IdeaBoard.Repo.query("SELECT * FROM users WHERE user_id = ?", [user_id])
    result.rows[0]
  end
end
