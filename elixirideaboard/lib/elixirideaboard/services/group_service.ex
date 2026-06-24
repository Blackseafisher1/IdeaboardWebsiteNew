defmodule Elixirideaboard.GroupService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/groups.sql")

  def list do
    case list_groups(%{}) do
      {:ok, groups} -> groups
      _ -> []
    end
  end

  def get(id) do
    case get_group(id: id) do
      {:ok, [group]} -> group
      _ -> nil
    end
  end

  def create(attrs) do
    is_private = if attrs.is_private, do: 1, else: 0
    case create_group(name: attrs.name, owner_user_id: attrs.owner_user_id, is_private: is_private) do
      {:ok, %{last_insert_id: id}} ->
        add_member(group_id: id, user_id: attrs.owner_user_id, role: "owner")
        {:ok, id}
      error -> error
    end
  end

  def is_member?(group_id, user_id) do
    case is_member(group_id: group_id, user_id: user_id) do
      {:ok, [_]} -> true
      _ -> false
    end
  end

  def members(group_id) do
    case get_members(group_id: group_id) do
      {:ok, mems} -> mems
      _ -> []
    end
  end

  def add_member_to_group(group_id, user_id, role \\ "member") do
    add_member(group_id: group_id, user_id: user_id, role: role)
  end

  def remove_member(group_id, user_id) do
    remove_member_query(group_id: group_id, user_id: user_id)
  end

  def member_role(group_id, user_id) do
    case get_member_role(group_id: group_id, user_id: user_id) do
      {:ok, [%{role: role}]} -> role
      _ -> nil
    end
  end

  def latest_messages(group_id, limit \\ 20) do
    case get_group_messages_latest(group_id: group_id, limit: limit) do
      {:ok, msgs} -> Enum.reverse(msgs)
      _ -> []
    end
  end

  def messages_since(group_id, after_id) do
    case get_group_messages(group_id: group_id, after_id: after_id) do
      {:ok, msgs} -> msgs
      _ -> []
    end
  end

  def messages_before(group_id, before_id, limit \\ 20) do
    case get_group_messages_before(group_id: group_id, before_id: before_id, limit: limit) do
      {:ok, msgs} -> Enum.reverse(msgs)
      _ -> []
    end
  end

  def send_message(group_id, sender_id, content) do
    case send_group_message(group_id: group_id, sender_id: sender_id, content: content) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  def ensure_project_sync(group_id, user_id) do
    group = get(group_id)
    if group && group.project_id do
      if ProjectService.is_team_member(group.project_id, user_id) do
        unless is_member?(group_id, user_id) do
          add_member(group_id: group_id, user_id: user_id, role: "member")
        end
      end
    end
  end
end
