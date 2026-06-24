defmodule IdeaBoard.UserController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
      :update_profile -> handle_update_profile(conn)
      :change_password -> handle_change_password(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    unless user do
      redirect(conn, "/users/auth")
    else
      html = IdeaBoard.Renderer.render_page("users/account", [user: user], conn)
      send_resp(conn, 200, html)
    end
  end

  defp handle_update_profile(conn) do
    user = get_session(conn, :user)
    username = Map.get(conn.params, "username", "")

    if String.length(username) >= 2 do
      IdeaBoard.UserService.update_profile(user.user_id, %{"username" => username})
      conn = put_session(conn, :user, Map.put(user, :username, username))
      redirect(conn, "/users/account")
    else
      html = IdeaBoard.Renderer.render_page("users/account", [user: user, error: "Benutzername zu kurz"], conn)
      send_resp(conn, 400, html)
    end
  end

  defp handle_change_password(conn) do
    user = get_session(conn, :user)
    current = Map.get(conn.params, "current_password", "")
    new_pw = Map.get(conn.params, "new_password", "")

    if new_pw == "" do
      html = IdeaBoard.Renderer.render_page("users/account", [user: user, pw_error: "Neues Passwort eingeben"], conn)
      send_resp(conn, 400, html)
    else
      case IdeaBoard.AuthService.change_password(user.user_id, current, new_pw) do
        :ok -> redirect(conn, "/users/account")
        {:error, reason} ->
          html = IdeaBoard.Renderer.render_page("users/account", [user: user, pw_error: reason], conn)
          send_resp(conn, 400, html)
      end
    end
  end

  defp redirect(conn, location) do
    conn
    |> put_resp_header("location", location)
    |> send_resp(302, "")
  end
end
