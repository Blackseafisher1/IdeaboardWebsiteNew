defmodule Elixirideaboard.UserService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/users.sql")

  def get(id) do
    case get_user(id: id) do
      {:ok, [user]} -> user
      _ -> nil
    end
  end

  def get_minimal(id) do
    case get_user_minimal(id: id) do
      {:ok, [user]} -> user
      _ -> nil
    end
  end

  def search(query, limit \\ 20) do
    case search_users(query: query, limit: limit) do
      {:ok, users} -> users
      _ -> []
    end
  end

  def create(attrs) do
    hash = Argon2.hash_pwd_salt(attrs.password)
    case create_user(
      username: attrs.username,
      email: attrs.email,
      password_hash: hash,
      role_id: 3
    ) do
      {:ok, %{last_insert_id: id}} -> {:ok, id}
      error -> error
    end
  end
end
