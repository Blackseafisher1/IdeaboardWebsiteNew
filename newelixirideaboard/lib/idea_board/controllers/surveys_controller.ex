defmodule IdeaBoard.SurveysController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    surveys = IdeaBoard.SurveyService.list(user)
    html = IdeaBoard.Renderer.render_page("surveys/index", %{surveys: surveys}, conn)
    send_resp(conn, 200, html)
  end
end
