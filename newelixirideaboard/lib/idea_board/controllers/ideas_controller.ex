defmodule IdeaBoard.IdeasController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
      :create -> handle_create(conn)
      :edit -> handle_edit(conn)
      :delete -> handle_delete(conn)
      :like -> handle_like(conn)
      :stats -> handle_stats(conn)
      :chunk -> handle_chunk(conn)
      :card -> handle_card(conn)
      :modal -> handle_modal(conn)
      :ws_dispatch -> ws_dispatch(conn)
      :search -> handle_search(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    filters = parse_filters(conn.params)
    categories = IdeaBoard.CategoriesService.all()
    result = IdeaBoard.IdeasService.list(user, filters)

    html = if Map.get(conn.params, "_page", "1") == "1" do
      assigns = Map.merge(result, %{categories: categories, filters: filters, user: user})
      if htmx?(conn), do: IdeaBoard.Renderer.render_partial_string("ideas/_content", assigns, conn),
        else: IdeaBoard.Renderer.render_page("ideas/ideas", assigns, conn)
    else
      IdeaBoard.Renderer.render_partial_string("ideas/_list", result, conn)
    end

    send_resp(conn, 200, html)
  end

  defp handle_chunk(conn) do
    user = get_session(conn, :user)
    filters = parse_filters(conn.params)
    result = IdeaBoard.IdeasService.list(user, filters)
    html = if Map.get(conn.params, "format") == "json" do
      Jason.encode!(%{ideas: result.ideas, has_next: result.has_next, page: result.page})
    else
      IdeaBoard.Renderer.render_partial_string("ideas/_list", result, conn)
    end
    send_resp(conn, 200, html)
  end

  defp handle_search(conn) do
    user = get_session(conn, :user)
    query = Map.get(conn.params, "q", "")
    page = (Map.get(conn.params, "page", "1") |> String.to_integer())
    result = IdeaBoard.IdeasSearchService.search(user, query, page)
    html = IdeaBoard.Renderer.render_partial_string("ideas/_list", result, conn)
    assign(conn, :rendered_html, html)
  end

  defp handle_create(conn) do
    user = get_session(conn, :user)
    data = %{
      title: Map.get(conn.params, "title", ""),
      description: Map.get(conn.params, "description", ""),
      category_id: Map.get(conn.params, "category_id"),
      tags: Map.get(conn.params, "tags", "")
    }

    if data.title == "" do
      send_json(conn, 400, %{error: "Titel erforderlich"})
    else
      {:ok, %{idea_id: idea_id}} = IdeaBoard.IdeasService.create(user, data)
      if idea_id && idea_id > 0 do
        {:ok, %{rows: [idea | _]}} = IdeaBoard.IdeasService.fetch(idea_id)
        IdeaBoard.PubSub.broadcast("ideas", {:idea_created, idea})
        html = IdeaBoard.Renderer.render_partial_string("ideas/_idea_card", %{idea: idea, user: user}, conn)
        send_resp(conn, 200, html)
      else
        send_json(conn, 500, %{error: "DB not available"})
      end
    end
  end

  defp handle_edit(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    data = %{
      title: Map.get(conn.params, "title"),
      description: Map.get(conn.params, "description"),
      category_id: Map.get(conn.params, "category_id"),
      status: Map.get(conn.params, "status"),
      tags: Map.get(conn.params, "tags")
    }

    case IdeaBoard.IdeasService.update(user, idea_id, data) do
      {:ok, idea} ->
        IdeaBoard.PubSub.broadcast("ideas", {:idea_updated, idea})
        html = IdeaBoard.Renderer.render_partial_string("ideas/_idea_card", %{idea: idea, user: user}, conn)
        send_resp(conn, 200, html)

      {:error, reason} -> send_json(conn, 400, %{error: reason})
    end
  end

  defp handle_delete(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")

    case IdeaBoard.IdeasService.delete(user, idea_id) do
      :ok ->
        IdeaBoard.PubSub.broadcast("ideas", {:idea_deleted, idea_id})
        send_resp(conn, 200, "")

      {:error, reason} -> send_json(conn, 400, %{error: reason})
    end
  end

  defp handle_like(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    reaction_type = Map.get(conn.params, "type", "like")

    case IdeaBoard.ReactionsService.toggle(user, idea_id, reaction_type) do
      {:ok, stats} ->
        IdeaBoard.PubSub.broadcast("idea:#{idea_id}", {:reaction_updated, idea_id, stats})
        html = IdeaBoard.Renderer.render_partial_string("ideas/_idea_stats", %{stats: stats}, conn)
        send_resp(conn, 200, html)

      _ -> send_resp(conn, 200, "")
    end
  end

  defp handle_stats(conn) do
    idea_id = Map.get(conn.params, "idea_id")
    stats = IdeaBoard.IdeasStatsService.get_stats(idea_id)
    html = IdeaBoard.Renderer.render_partial_string("ideas/_idea_stats", %{stats: stats}, conn)
    send_resp(conn, 200, html)
  end

  defp handle_card(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    case IdeaBoard.IdeasService.fetch(idea_id) do
      {:ok, idea} when not is_nil(idea) ->
        html = IdeaBoard.Renderer.render_partial_string("ideas/_idea_card", %{idea: idea, user: user}, conn)
        send_resp(conn, 200, html)
      _ -> send_resp(conn, 404, "not found")
    end
  end

  defp handle_modal(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")
    case IdeaBoard.IdeasService.fetch(idea_id) do
      {:ok, idea} when not is_nil(idea) ->
        html = IdeaBoard.Renderer.render_partial_string("ideas/_idea_modal", %{idea: idea, user: user}, conn)
        send_resp(conn, 200, html)
      _ -> send_resp(conn, 404, "not found")
    end
  end

  defp ws_dispatch(conn) do
    action = Map.get(conn.params, "action", "list")
    call(conn, String.to_existing_atom(action))
  rescue
    _ -> assign(conn, :rendered_html, ~s({"error":"unknown action"}))
  end

  defp parse_filters(params) do
    %{
      q: Map.get(params, "q", ""),
      category_id: Map.get(params, "category_id"),
      sort: Map.get(params, "sort", "latest"),
      tags: Map.get(params, "tags", ""),
      owned_only: Map.get(params, "owned_only", "false"),
      page: (Map.get(params, "page", "1") |> String.to_integer())
    }
  end

  defp htmx?(conn), do: Plug.Conn.get_req_header(conn, "hx-request") != []

  defp send_json(conn, status, data) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(data))
  end
end
