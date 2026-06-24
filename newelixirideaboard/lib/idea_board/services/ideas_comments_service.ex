defmodule IdeaBoard.IdeasCommentsService do
  def list(idea_id) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT c.*, u.username AS author_username FROM idea_comments c JOIN users u ON u.user_id = c.user_id WHERE c.idea_id = ? ORDER BY c.created_at ASC",
      [idea_id]
    )
    result.rows || []
  end

  def create(_user, idea_id, text) when is_binary(text) and text != "" do
    IdeaBoard.Repo.query(
      "INSERT INTO idea_comments (idea_id, text, created_at) VALUES (?, ?, NOW())",
      [idea_id, String.trim(text)]
    )

    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT c.*, u.username AS author_username FROM idea_comments c JOIN users u ON u.user_id = c.user_id WHERE c.idea_id = ? ORDER BY c.created_at DESC LIMIT 1",
      [idea_id]
    )
    {:ok, result.rows[0]}
  end
  def create(_, _, _), do: {:error, "Ungültige Eingabe"}

  def delete(user, comment_id) do
    case IdeaBoard.Repo.query("SELECT * FROM idea_comments WHERE comment_id = ?", [comment_id]) do
      {:ok, %{rows: [comment | _]}} ->
        if comment.user_id == user.user_id || IdeaBoard.RoleHelpers.is_admin?(user) do
          IdeaBoard.Repo.query("DELETE FROM idea_comments WHERE comment_id = ?", [comment_id])
          :ok
        else
          {:error, "Nicht berechtigt"}
        end

      _ -> {:error, "Kommentar nicht gefunden"}
    end
  end
end
