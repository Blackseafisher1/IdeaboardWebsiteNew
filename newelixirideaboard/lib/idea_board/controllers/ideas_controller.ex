defmodule IdeaBoard.IdeasController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> handle_index(conn)
      :ws_dispatch -> ws_dispatch(conn)
      :search -> handle_search(conn)
      :create -> handle_create(conn)
      :edit -> handle_edit(conn)
      :delete -> handle_delete(conn)
    end
  end

  defp handle_index(conn) do
    user = get_session(conn, :user)
    filters = %{
      q: Map.get(conn.params, "q", ""),
      category_id: Map.get(conn.params, "category_id"),
      sort: Map.get(conn.params, "sort", "latest"),
      page: (Map.get(conn.params, "page", "1") |> String.to_integer())
    }

    categories = IdeaBoard.CategoriesService.all()
    result = IdeaBoard.IdeasService.list(user, filters)
    html = IdeaBoard.Renderer.render("ideas/ideas", Map.merge(result, %{categories: categories, filters: filters}), conn)
    send_resp(conn, 200, html)
  end

  defp handle_search(conn) do
    user = get_session(conn, :user)
    query = Map.get(conn.params, "q", "")
    page = (Map.get(conn.params, "page", "1") |> String.to_integer())
    result = IdeaBoard.IdeasSearchService.search(user, query, page)
    html = IdeaBoard.Renderer.render_raw("ideas/_list", result, conn)
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

    {:ok, %{idea_id: idea_id}} = IdeaBoard.IdeasService.create(user, data)
    {:ok, %{rows: [idea | _]}} = IdeaBoard.IdeasService.fetch(idea_id)
    IdeaBoard.PubSub.broadcast("ideas", {:idea_created, idea})
    html = IdeaBoard.Renderer.render_raw("ideas/_idea_card", %{idea: idea, user: user}, conn)
    assign(conn, :rendered_html, html)
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
        html = IdeaBoard.Renderer.render_raw("ideas/_idea_card", %{idea: idea, user: user}, conn)
        assign(conn, :rendered_html, html)

      {:error, reason} ->
        assign(conn, :rendered_html, Jason.encode!(%{error: reason}))
    end
  end

  defp handle_delete(conn) do
    user = get_session(conn, :user)
    idea_id = Map.get(conn.params, "idea_id")

    case IdeaBoard.IdeasService.delete(user, idea_id) do
      :ok ->
        IdeaBoard.PubSub.broadcast("ideas", {:idea_deleted, idea_id})
        assign(conn, :rendered_html, "")

      {:error, reason} ->
        assign(conn, :rendered_html, Jason.encode!(%{error: reason}))
    end
  end

  defp ws_dispatch(conn) do
    action = Map.get(conn.params, "action", "list")
    call(conn, String.to_existing_atom(action))
  rescue
    _ -> assign(conn, :rendered_html, ~s({"error":"unknown action"}))
  end
end
