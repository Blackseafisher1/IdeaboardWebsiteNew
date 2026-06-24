defmodule Elixirideaboard.AuthController do
  use Elixirideaboard.Web, :controller

  def login(conn, %{"username" => username, "password" => password}) do
    case Elixirideaboard.AuthService.login(username, password) do
      {:ok, user} ->
        conn
        |> put_session(:user_id, user.user_id)
        |> redirect(to: "/ideas")
      {:error, _reason} ->
        redirect(conn, to: "/users/auth")
    end
  end

  def set_session(conn, %{"user_id" => user_id}) do
    conn
    |> put_session(:user_id, String.to_integer(user_id))
    |> redirect(to: "/ideas")
  end

  def logout(conn, _params) do
    conn
    |> clear_session()
    |> redirect(to: "/")
  end
end
