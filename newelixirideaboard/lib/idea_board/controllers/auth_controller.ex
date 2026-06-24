defmodule IdeaBoard.AuthController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :login_form -> render_login(conn)
      :login -> handle_login(conn)
      :register -> handle_register(conn)
      :logout -> handle_logout(conn)
    end
  end

  defp render_login(conn) do
    html = IdeaBoard.Renderer.render("auth/login.html.heex", [error: nil], conn)
    send_resp(conn, 200, html)
  end

  defp handle_login(conn) do
    email = Map.get(conn.params, "email", "")
    password = Map.get(conn.params, "password", "")

    case IdeaBoard.AuthService.authenticate(email, password) do
      {:ok, user} ->
        conn = put_session(conn, :user, user)
        redirect(conn, "/")

      {:error, reason} ->
        html = IdeaBoard.Renderer.render("auth/login.html.heex", [error: reason], conn)
        send_resp(conn, 401, html)
    end
  end

  defp handle_register(conn) do
    username = Map.get(conn.params, "username", "")
    email = Map.get(conn.params, "email", "")
    password = Map.get(conn.params, "password", "")

    case IdeaBoard.AuthService.register(username, email, password) do
      {:ok, user} ->
        conn = put_session(conn, :user, user)
        redirect(conn, "/")

      {:error, reason} ->
        html = IdeaBoard.Renderer.render("auth/login.html.heex", [error: reason], conn)
        send_resp(conn, 400, html)
    end
  end

  defp handle_logout(conn) do
    conn = clear_session(conn)
    redirect(conn, "/")
  end

  defp redirect(conn, location) do
    conn
    |> put_resp_header("location", location)
    |> send_resp(302, "")
  end
end
