defmodule IdeaBoard.GroupsController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
      :ws_dispatch -> ws_dispatch(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    groups = IdeaBoard.GroupService.list_for_user(user)
    html = IdeaBoard.Renderer.render("groups/index", %{groups: groups}, conn)
    send_resp(conn, 200, html)
  end

  defp ws_dispatch(conn) do
    user = get_session(conn, :user)
    action = Map.get(conn.params, "action", "list")

    case action do
      "list" ->
        group_id = Map.get(conn.params, "group_id")
        messages = IdeaBoard.GroupService.latest_messages(group_id, 50)
        html = IdeaBoard.Renderer.render_raw("groups/_chat", %{group_id: group_id, messages: messages, user: user}, conn)
        assign(conn, :rendered_html, html)

      "send" ->
        text = Map.get(conn.params, "text", "")
        group_id = Map.get(conn.params, "group_id")
        case IdeaBoard.GroupService.send_message(group_id, user.user_id, text) do
          {:ok, msg} ->
            IdeaBoard.PubSub.broadcast("group:#{group_id}", {:new_message, msg})
            html = IdeaBoard.Renderer.render_raw("groups/_message", %{message: msg, user: user}, conn)
            assign(conn, :rendered_html, html)

          _ -> assign(conn, :rendered_html, "")
        end

      "history" ->
        group_id = Map.get(conn.params, "group_id")
        before_id = Map.get(conn.params, "before_id")
        messages = IdeaBoard.GroupService.messages_before(group_id, before_id, 20)
        html = IdeaBoard.Renderer.render_raw("groups/_messages", %{messages: messages, user: user}, conn)
        assign(conn, :rendered_html, html)

      _ -> assign(conn, :rendered_html, "")
    end
  end
end
