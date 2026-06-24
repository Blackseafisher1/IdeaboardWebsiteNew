defmodule IdeaBoard.WsHandler do
  @moduledoc """
  WebSocket handler for HTMX over WebSocket (hx-ws extension).
  Uses Bandit.WebSocket.Handler behaviour.
  """

  require Logger

  def handle_ws_connect(conn, state) do
    user = Plug.Conn.get_session(conn, :user)
    {:ok, Map.put(state, :user, user)}
  end

  def handle_ws_frame({:text, message}, _conn, state) do
    case Jason.decode(message) do
      {:ok, %{"HEADERS" => headers, "method" => "POST", "url" => url, "body" => body}} ->
        ws_conn = build_conn(state, headers, body)
        response = dispatch(url, ws_conn, state)
        {:reply, {:text, response}, state}

      {:ok, %{"type" => "subscribe", "topic" => topic}} ->
        IdeaBoard.PubSub.subscribe(topic)
        {:ok, state}

      {:ok, %{"type" => "unsubscribe", "topic" => topic}} ->
        IdeaBoard.PubSub.unsubscribe(topic)
        {:ok, state}

      _ ->
        {:reply, {:text, ~s({"error":"invalid message"})}, state}
    end
  end

  def handle_ws_frame({:ping, payload}, _conn, state) do
    {:reply, {:pong, payload}, state}
  end

  def handle_ws_frame(_, _conn, state) do
    {:ok, state}
  end

  defp dispatch("/ideas", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.IdeasController.call(conn, :ws_dispatch)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/ideas/search", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.IdeasController.call(conn, :search)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/ideas/create", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.IdeasController.call(conn, :create)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/ideas/edit", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.IdeasController.call(conn, :edit)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/ideas/delete", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.IdeasController.call(conn, :delete)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/ideas/like", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.ReactionsController.call(conn, :toggle)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/comments", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.CommentsController.call(conn, :ws_dispatch)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/dms", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.DmsController.call(conn, :ws_dispatch)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch("/groups", conn, _state) do
    conn = Map.put(conn.assigns, :transport, :ws)
    conn = IdeaBoard.GroupsController.call(conn, :ws_dispatch)
    conn.assigns[:rendered_html] || ""
  end

  defp dispatch(url, _conn, _state) do
    Logger.warning("No WS handler for #{url}")
    ~s({"error":"no handler for #{url}"})
  end

  defp build_conn(state, headers, body) do
    params = if is_map(body), do: body, else: %{}
    %Plug.Conn{
      adapter: {Bandit.Adapter, %{}},
      assigns: %{user: state[:user], rendered_html: nil},
      params: params,
      body_params: params,
      req_headers: headers,
      request_path: "",
      method: "POST"
    }
  end
end
