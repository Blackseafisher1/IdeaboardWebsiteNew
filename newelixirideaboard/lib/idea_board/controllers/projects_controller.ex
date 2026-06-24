defmodule IdeaBoard.ProjectsController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    projects = IdeaBoard.ProjectService.list(user)
    html = IdeaBoard.Renderer.render_page("projects/index", %{projects: projects}, conn)
    send_resp(conn, 200, html)
  end
end
