defmodule Elixirideaboard.AdminService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/admin.sql")

  def list_users do
    case list_users(%{}) do
      {:ok, users} -> users
      _ -> []
    end
  end

  def set_role(user_id, role_name) do
    role_id = role_name_to_id(role_name)
    update_user_role(user_id: user_id, role_id: role_id)
  end

  defp role_name_to_id("Admin"), do: 1
  defp role_name_to_id("Projektleiter"), do: 2
  defp role_name_to_id("Mitarbeiter"), do: 3
  defp role_name_to_id(_), do: 3

  def delete(user_id) do
    delete_user(user_id: user_id)
  end
end
