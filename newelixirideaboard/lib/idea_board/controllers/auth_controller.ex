defmodule IdeaBoard.AuthController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :login_form -> render_login(conn, nil)
      :login -> handle_login(conn)
      :register -> handle_register(conn)
      :logout -> handle_logout(conn)
    end
  end

  defp render_login(conn, error) do
    html = IdeaBoard.Renderer.render("auth/login", [error: error, form: "login"], conn)
    send_resp(conn, 200, html)
  end

  defp handle_login(conn) do
    email = Map.get(conn.params, "email", "")
    password = Map.get(conn.params, "password", "")

    if email == "" or password == "" do
      html = IdeaBoard.Renderer.render("auth/login", [error: "Bitte E-Mail und Passwort eingeben", form: "login"], conn)
      send_resp(conn, 400, html)
    else
      case IdeaBoard.AuthService.authenticate(email, password) do
        {:ok, user} ->
          conn = put_session(conn, :user, user)
          redirect(conn, "/")

        {:error, reason} ->
          html = IdeaBoard.Renderer.render("auth/login", [error: reason, form: "login"], conn)
          send_resp(conn, 401, html)
      end
    end
  end

  defp handle_register(conn) do
    username = Map.get(conn.params, "username", "")
    email = Map.get(conn.params, "email", "")
    password = Map.get(conn.params, "password", "")

    if username == "" or email == "" or password == "" do
      html = IdeaBoard.Renderer.render("auth/login", [error: "Bitte alle Felder ausfüllen", form: "register"], conn)
      send_resp(conn, 400, html)
    else
      case IdeaBoard.AuthService.register(username, email, password) do
        {:ok, user} ->
          conn = put_session(conn, :user, user)
          redirect(conn, "/")

        {:error, reason} ->
          html = IdeaBoard.Renderer.render("auth/login", [error: reason, form: "register"], conn)
          send_resp(conn, 400, html)
      end
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
