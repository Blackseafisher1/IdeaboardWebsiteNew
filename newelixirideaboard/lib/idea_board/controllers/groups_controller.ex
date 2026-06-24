defmodule IdeaBoard.GroupsController do
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
    groups = IdeaBoard.GroupService.list_for_user(user)
    html = IdeaBoard.Renderer.render_page("groups/index", %{groups: groups}, conn)
    send_resp(conn, 200, html)
  end

  defp ws_dispatch(conn, user) do
    action = Map.get(conn.params, "action", "list")
    case action do
      "list" ->
        group_id = Map.get(conn.params, "group_id")
        messages = IdeaBoard.GroupService.latest_messages(group_id, 50)
        html = IdeaBoard.Renderer.render_partial_string("groups/_chat", %{group_id: group_id, messages: messages, user: user}, conn)
        assign(conn, :rendered_html, html)
      "send" ->
        text = Map.get(conn.params, "text", "")
        group_id = Map.get(conn.params, "group_id")
        case IdeaBoard.GroupService.send_message(group_id, user.user_id, text) do
          {:ok, msg} ->
            IdeaBoard.PubSub.broadcast("group:#{group_id}", {:new_message, msg})
            html = IdeaBoard.Renderer.render_partial_string("groups/_message", %{message: msg, user: user}, conn)
            assign(conn, :rendered_html, html)
          _ -> assign(conn, :rendered_html, "")
        end
      "history" ->
        group_id = Map.get(conn.params, "group_id")
        before_id = Map.get(conn.params, "before_id")
        messages = IdeaBoard.GroupService.messages_before(group_id, before_id, 20)
        html = IdeaBoard.Renderer.render_partial_string("groups/_messages", %{messages: messages, user: user}, conn)
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
