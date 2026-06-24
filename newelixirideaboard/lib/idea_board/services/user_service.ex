defmodule IdeaBoard.UserService do
  def get(user_id) do
    try do
      case IdeaBoard.Repo.query_map("SELECT * FROM users WHERE user_id = ?", [user_id]) do
        {:ok, nil} -> nil
        {:ok, user} -> user
        _ -> nil
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> nil
    end
  end

  def update_profile(user_id, data) do
    try do
      username = data["username"]
      IdeaBoard.Repo.query("UPDATE users SET username = ? WHERE user_id = ?", [username, user_id])
      :ok
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> :ok
    end
  end
end
