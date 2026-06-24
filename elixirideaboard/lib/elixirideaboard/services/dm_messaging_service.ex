defmodule Elixirideaboard.DmMessagingService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/dms.sql")

  def conversations(user_id) do
    case get_conversations(user_id: user_id) do
      {:ok, convs} -> convs
      _ -> []
    end
  end

  def get_or_create(user1_id, user2_id) do
    case get_or_create_conversation(user1: user1_id, user2: user2_id) do
      {:ok, [%{conversation_id: id}]} -> id
      _ ->
        {:ok, %{last_insert_id: id}} = create_conversation(%{})
        add_participant(conversation_id: id, user_id: user1_id)
        add_participant(conversation_id: id, user_id: user2_id)
        id
    end
  end

  def latest_messages(conv_id, limit \\ 20) do
    case get_messages(conversation_id: conv_id, limit: limit) do
      {:ok, msgs} -> Enum.reverse(msgs)
      _ -> []
    end
  end

  def messages_before(conv_id, before_id, limit \\ 20) do
    case get_messages_before(conversation_id: conv_id, before_id: before_id, limit: limit) do
      {:ok, msgs} -> Enum.reverse(msgs)
      _ -> []
    end
  end

  def new_messages(conv_id, after_id) do
    case get_new_messages(conversation_id: conv_id, after_id: after_id) do
      {:ok, msgs} -> msgs
      _ -> []
    end
  end

  def send(conv_id, sender_id, content) do
    case send_message(conversation_id: conv_id, sender_id: sender_id, content: content) do
      {:ok, %{last_insert_id: id}} -> get_message(id)
      error -> error
    end
  end

  def get_message(id) do
    case get_message_by_id(message_id: id) do
      {:ok, [msg]} -> msg
      _ -> nil
    end
  end

  def update_message(msg_id, user_id, content) do
    update_message(message_id: msg_id, user_id: user_id, content: content)
  end

  def delete_message(msg_id, user_id) do
    delete_message_query(message_id: msg_id, user_id: user_id)
  end
end
