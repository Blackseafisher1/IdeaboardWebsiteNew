defmodule Elixirideaboard.AuthService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/auth.sql")

  def login(username_or_email, password) do
    case login_query(username: username_or_email, email: username_or_email) do
      {:ok, [user]} ->
        if Argon2.verify_pass(password, user.password_hash) do
          set_session(user_id: user.user_id)
          {:ok, user}
        else
          {:error, :invalid_credentials}
        end
      {:ok, []} ->
        {:error, :user_not_found}
      {:error, reason} ->
        {:error, reason}
    end
  end

  def ensure_default_admin do
    case ensure_default_admin(%{}) do
      {:ok, [admin]} -> {:ok, admin}
      {:ok, []} ->
        password = generate_temp_password()
        hash = Argon2.hash_pwd_salt(password)
        create_default_admin(password_hash: hash)
        IO.puts("Default admin created — password: #{password}")
        {:ok, :created}
      {:error, reason} -> {:error, reason}
    end
  end

  defp generate_temp_password do
    :crypto.strong_rand_bytes(12) |> Base.url_encode64(padding: false) |> binary_part(0, 16)
  end
end
