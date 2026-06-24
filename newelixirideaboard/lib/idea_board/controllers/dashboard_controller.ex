defmodule IdeaBoard.DashboardController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    stats = IdeaBoard.DashboardService.get_stats(user)
    html = IdeaBoard.Renderer.render("dashboard/index.html.heex", stats, conn)
    send_resp(conn, 200, html)
  end
end
