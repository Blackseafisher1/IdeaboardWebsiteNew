defmodule IdeaBoard.DmMessagingService do
  def list_conversations(user) do
    try do
      case IdeaBoard.Repo.query_maps(
             "SELECT c.*, u1.username AS user1_username, u2.username AS user2_username FROM conversations c JOIN users u1 ON u1.user_id = c.user_id_1 JOIN users u2 ON u2.user_id = c.user_id_2 WHERE c.user_id_1 = ? OR c.user_id_2 = ? ORDER BY c.last_message_at DESC",
             [user.user_id, user.user_id]
           ) do
        {:ok, maps} -> maps
        _ -> []
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end

  def get_or_create_conversation(current_user, params) do
    other_id = Map.get(params, "user_id")
    if other_id do
      try do
        id1 = min(current_user.user_id, String.to_integer(other_id))
        id2 = max(current_user.user_id, String.to_integer(other_id))

        case IdeaBoard.Repo.query_map(
               "SELECT * FROM conversations WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?) LIMIT 1",
               [id1, id2, id2, id1]
             ) do
          {:ok, conv} when not is_nil(conv) -> conv
          _ ->
            IdeaBoard.Repo.query(
              "INSERT INTO conversations (user_id_1, user_id_2, created_at, last_message_at) VALUES (?, ?, NOW(), NOW())",
              [id1, id2]
            )
            case IdeaBoard.Repo.query_map(
                   "SELECT * FROM conversations WHERE user_id_1 = ? AND user_id_2 = ? LIMIT 1",
                   [id1, id2]
                 ) do
              {:ok, conv} -> conv
              _ -> nil
            end
        end
      rescue
        _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> nil
      end
    end
  end

  def latest_messages(conv_id, limit \\ 50) do
    try do
      case IdeaBoard.Repo.query_maps(
             "SELECT m.*, u.username AS sender_username FROM dm_messages m JOIN users u ON u.user_id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at DESC LIMIT ?",
             [conv_id, limit]
           ) do
        {:ok, maps} -> maps
        _ -> []
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end

  def messages_before(conv_id, before_id, limit \\ 20) do
    try do
      case IdeaBoard.Repo.query_maps(
             "SELECT m.*, u.username AS sender_username FROM dm_messages m JOIN users u ON u.user_id = m.sender_id WHERE m.conversation_id = ? AND m.message_id < ? ORDER BY m.created_at DESC LIMIT ?",
             [conv_id, before_id, limit]
           ) do
        {:ok, maps} -> maps
        _ -> []
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end

  def send_message(conv_id, user_id, text) when is_binary(text) and text != "" do
    try do
      IdeaBoard.Repo.query(
        "INSERT INTO dm_messages (conversation_id, sender_id, text, created_at) VALUES (?, ?, ?, NOW())",
        [conv_id, user_id, String.trim(text)]
      )
      case IdeaBoard.Repo.query_map(
             "SELECT m.*, u.username AS sender_username FROM dm_messages m JOIN users u ON u.user_id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at DESC LIMIT 1",
             [conv_id]
           ) do
        {:ok, msg} -> {:ok, msg}
        _ -> {:error, "Fehler beim Senden"}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> {:error, "DB nicht verfügbar"}
    end
  end
  def send_message(_, _, _), do: {:error, "Leere Nachricht"}
end
