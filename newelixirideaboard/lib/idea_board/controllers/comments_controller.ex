defmodule IdeaBoard.CommentsController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :list -> handle_list(conn)
      :create -> handle_create(conn)
      :delete -> handle_delete(conn)
      :ws_dispatch -> ws_dispatch(conn)
    end
  end

  defp handle_list(conn) do
    idea_id = Map.get(conn.params, "idea_id")
    user = get_session(conn, :user)
    comments = IdeaBoard.IdeasCommentsService.list(idea_id)
    html = IdeaBoard.Renderer.render_partial_string("ideas/_comments_section", %{comments: comments, idea_id: idea_id, user: user}, conn)
    send_resp(conn, 200, html)
  end

  defp handle_create(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    text = Map.get(conn.params, "text", "")

    case IdeaBoard.IdeasCommentsService.create(user, idea_id, text) do
      {:ok, comment} ->
        IdeaBoard.PubSub.broadcast("idea:#{idea_id}", {:new_comment, comment})
        html = IdeaBoard.Renderer.render_partial_string("ideas/_comment_item", %{comment: comment, user: user}, conn)
        send_resp(conn, 200, html)

      _ -> send_resp(conn, 400, "Fehler")
    end
  end

  defp handle_delete(conn) do
    user = get_session(conn, :user)
    comment_id = Map.get(conn.params, "comment_id")

    case IdeaBoard.IdeasCommentsService.delete(user, comment_id) do
      :ok -> send_resp(conn, 200, "")
      {:error, reason} -> send_resp(conn, 400, reason)
    end
  end

  defp ws_dispatch(conn) do
    action = Map.get(conn.params, "action", "list")
    call(conn, String.to_existing_atom(action))
  rescue
    _ -> assign(conn, :rendered_html, ~s({"error":"unknown action"}))
  end
end
