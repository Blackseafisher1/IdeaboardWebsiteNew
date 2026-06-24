defmodule IdeaBoard.GroupService do
  def list_for_user(user) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.group_id WHERE gm.user_id = ? ORDER BY g.name ASC",
      [user.user_id]
    )
    result.rows || []
  end

  def latest_messages(group_id, limit \\ 50) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT gm.*, u.username AS sender_username FROM group_messages gm JOIN users u ON u.user_id = gm.sender_id WHERE gm.group_id = ? ORDER BY gm.created_at DESC LIMIT ?",
      [group_id, limit]
    )
    result.rows || []
  end

  def messages_before(group_id, before_id, limit \\ 20) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT gm.*, u.username AS sender_username FROM group_messages gm JOIN users u ON u.user_id = gm.sender_id WHERE gm.group_id = ? AND gm.message_id < ? ORDER BY gm.created_at DESC LIMIT ?",
      [group_id, before_id, limit]
    )
    result.rows || []
  end

  def send_message(group_id, user_id, text) when is_binary(text) and text != "" do
    IdeaBoard.Repo.query(
      "INSERT INTO group_messages (group_id, sender_id, text, created_at) VALUES (?, ?, ?, NOW())",
      [group_id, user_id, String.trim(text)]
    )

    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT gm.*, u.username AS sender_username FROM group_messages gm JOIN users u ON u.user_id = gm.sender_id WHERE gm.group_id = ? ORDER BY gm.created_at DESC LIMIT 1",
      [group_id]
    )
    {:ok, result.rows[0]}
  end
  def send_message(_, _, _), do: {:error, "Leere Nachricht"}

  def get_file(group_id, filename, _user) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT * FROM group_files WHERE group_id = ? AND filename = ?",
      [group_id, filename]
    )
    case result.rows do
      [file] -> {:ok, file}
      _ -> {:error, "Datei nicht gefunden"}
    end
  end
end
