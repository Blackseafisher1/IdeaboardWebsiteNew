defmodule IdeaBoard.CommentsController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :ws_dispatch -> ws_dispatch(conn)
    end
  end

  defp ws_dispatch(conn) do
    action = Map.get(conn.params, "action", "list")
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    text = Map.get(conn.params, "text")

    case action do
      "list" ->
        comments = IdeaBoard.IdeasCommentsService.list(idea_id)
        html = IdeaBoard.Renderer.render_partial_string("ideas/_comments_section", %{comments: comments, idea_id: idea_id, user: user}, conn)
        assign(conn, :rendered_html, html)

      "create" ->
        case IdeaBoard.IdeasCommentsService.create(user, idea_id, text) do
          {:ok, comment} ->
            IdeaBoard.PubSub.broadcast("idea:#{idea_id}", {:new_comment, comment})
            html = IdeaBoard.Renderer.render_partial_string("ideas/_comment_item", %{comment: comment, user: user}, conn)
            assign(conn, :rendered_html, html)

          _ -> assign(conn, :rendered_html, "")
        end

      "delete" ->
        comment_id = Map.get(conn.params, "comment_id")
        IdeaBoard.IdeasCommentsService.delete(user, comment_id)
        assign(conn, :rendered_html, "")

      _ -> assign(conn, :rendered_html, "")
    end
  end
end
