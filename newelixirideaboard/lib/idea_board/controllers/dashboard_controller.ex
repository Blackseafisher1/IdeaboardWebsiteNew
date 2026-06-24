defmodule IdeaBoard.DashboardController do
  import Plug.Conn

  def call(conn, action) do
    user = get_session(conn, :user)
    if user, do: do_call(conn, action, user),
      else: redirect(conn, "/users/auth")
  end

  defp do_call(conn, action, user) do
    case action do
      :index -> handle_index(conn, user)
    end
  end

  defp handle_index(conn, user) do
    stats = IdeaBoard.DashboardService.get_stats(user)
    html = IdeaBoard.Renderer.render_page("dashboard/index", stats, conn)
    send_resp(conn, 200, html)
  end

  defp redirect(conn, location) do
    conn
    |> put_resp_header("location", location)
    |> send_resp(302, "")
    |> halt()
  end
end
