defmodule Elixirideaboard.RoleHelpers do
  def is_admin?(%{role_name: r}) when r in ["Admin", "administrator"], do: true
  def is_admin?(%{role_id: 1}), do: true
  def is_admin?(_), do: false

  def is_moderator?(%{role_name: r}) when r in ["Admin", "Projektleiter", "administrator"], do: true
  def is_moderator?(%{role_id: r}) when r in [1, 2], do: true
  def is_moderator?(_), do: false

  def can_manage_idea?(user, idea) when is_map(user) and is_map(idea) do
    is_admin?(user) || user.user_id == idea.user_id
  end
  def can_manage_idea?(_, _), do: false

  def can_manage_comment?(user, comment) when is_map(user) and is_map(comment) do
    is_admin?(user) || user.user_id == comment.user_id
  end
  def can_manage_comment?(_, _), do: false

  def can_access_conversation?(user, %{user_id_1: u1, user_id_2: u2}) do
    user.user_id == u1 || user.user_id == u2
  end
  def can_access_conversation?(_, _), do: false
end
