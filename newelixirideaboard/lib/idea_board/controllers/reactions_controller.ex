defmodule IdeaBoard.ReactionsController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :toggle -> handle_toggle(conn)
    end
  end

  defp handle_toggle(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    reaction_type = Map.get(conn.params, "type", "like")

    case IdeaBoard.ReactionsService.toggle(user, idea_id, reaction_type) do
      {:ok, stats} ->
        IdeaBoard.PubSub.broadcast("idea:#{idea_id}", {:reaction_updated, idea_id, stats})
        html = IdeaBoard.Renderer.render_raw("ideas/_idea_stats", %{stats: stats}, conn)
        assign(conn, :rendered_html, html)

      _ -> assign(conn, :rendered_html, "")
    end
  end
end
