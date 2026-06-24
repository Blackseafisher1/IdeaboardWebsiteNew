defmodule IdeaBoard.DmsController do
  import Plug.Conn

  def call(conn, action) do
    user = get_session(conn, :user)
    if user, do: do_call(conn, action, user),
      else: redirect(conn, "/users/auth")
  end

  defp do_call(conn, action, user) do
    case action do
      :index -> handle_index(conn, user)
      :ws_dispatch -> ws_dispatch(conn, user)
    end
  end

  defp handle_index(conn, user) do
    conversations = IdeaBoard.DmMessagingService.list_conversations(user)
    html = IdeaBoard.Renderer.render_page("dms/index", %{conversations: conversations}, conn)
    send_resp(conn, 200, html)
  end

  defp ws_dispatch(conn, user) do
    action = Map.get(conn.params, "action", "list")
    case action do
      "list" ->
        conv = IdeaBoard.DmMessagingService.get_or_create_conversation(user, conn.params)
        messages = if conv, do: IdeaBoard.DmMessagingService.latest_messages(conv.conversation_id, 50), else: []
        html = IdeaBoard.Renderer.render_partial_string("dms/_chat", %{conversation: conv, messages: messages, user: user}, conn)
        assign(conn, :rendered_html, html)
      "send" ->
        text = Map.get(conn.params, "text", "")
        conv_id = Map.get(conn.params, "conversation_id")
        case IdeaBoard.DmMessagingService.send_message(conv_id, user.user_id, text) do
          {:ok, msg} ->
            IdeaBoard.PubSub.broadcast("dm:#{conv_id}", {:new_message, msg})
            html = IdeaBoard.Renderer.render_partial_string("dms/_message", %{message: msg, user: user}, conn)
            assign(conn, :rendered_html, html)
          _ -> assign(conn, :rendered_html, "")
        end
      "history" ->
        conv_id = Map.get(conn.params, "conversation_id")
        before_id = Map.get(conn.params, "before_id")
        messages = IdeaBoard.DmMessagingService.messages_before(conv_id, before_id, 20)
        html = IdeaBoard.Renderer.render_partial_string("dms/_messages", %{messages: messages, user: user}, conn)
        assign(conn, :rendered_html, html)
      _ -> assign(conn, :rendered_html, "")
    end
  end

  defp redirect(conn, location) do
    conn
    |> put_resp_header("location", location)
    |> send_resp(302, "")
    |> halt()
  end
end
