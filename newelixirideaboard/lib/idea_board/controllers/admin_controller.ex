defmodule IdeaBoard.AdminController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)

    if !user || !IdeaBoard.RoleHelpers.is_admin?(user) do
      send_resp(conn, 403, "Forbidden")
    else
      data = IdeaBoard.AdminService.get_dashboard(user)
      html = IdeaBoard.Renderer.render_page("admin/index", data, conn)
      send_resp(conn, 200, html)
    end
  end
end
