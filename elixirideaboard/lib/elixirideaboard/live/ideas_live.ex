defmodule Elixirideaboard.IdeasLive do
  use Elixirideaboard.Web, :live_view

  alias Elixirideaboard.{IdeasService, IdeasSearchService, IdeasEnrichmentService, IdeasStatsService, CategoriesService, ReactionsService, IdeasCommentsService, IdeasFilesService, IdeasTagsService}

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Elixirideaboard.PubSub, "ideas")
    end

    {:ok, assign(socket,
      ideas: [],
      total: 0,
      page: 1,
      has_next: false,
      filters: %{q: "", category_id: nil, sort: "latest", owned_only: false, tags: "", search_scope: ""},
      categories: CategoriesService.all(),
      user_stats: nil,
      editing_idea_id: nil,
      show_create: false
    )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    filters = %{
      q: params["q"] || "",
      category_id: params["category_id"],
      sort: params["sort"] || "latest",
      owned_only: params["owned_only"] == "true",
      tags: params["tags"] || "",
      search_scope: params["search_scope"] || ""
    }
    page = String.to_integer(params["page"] || "1")
    user_id = socket.assigns.user.user_id
    user_stats = IdeasStatsService.get_weekly_remaining(user_id)

    results = if filters.q == "" do
      IdeasService.list(filters.category_id, filters.sort, page)
    else
      IdeasSearchService.search(filters.q, filters.search_scope, page)
    end

    ideas = Enum.map(results.ideas, &IdeasEnrichmentService.enrich_card(&1, socket.assigns.categories))

    {:noreply, assign(socket,
      ideas: ideas,
      page: page,
      has_next: results.has_next,
      total: results.total,
      filters: filters,
      user_stats: user_stats
    )}
  end

  @impl true
  def handle_event("filter", params, socket) do
    q = %{
      "q" => params["q"] || socket.assigns.filters.q,
      "category_id" => params["category_id"] || socket.assigns.filters.category_id,
      "sort" => params["sort"] || socket.assigns.filters.sort,
      "owned_only" => if(params["owned_only"] == "true", do: "true", else: "false"),
      "tags" => params["tags"] || socket.assigns.filters.tags,
      "search_scope" => params["search_scope"] || socket.assigns.filters.search_scope
    }
    {:noreply, push_patch(socket, to: "/ideas?" <> URI.encode_query(q))}
  end

  @impl true
  def handle_event("load-more", _, socket) do
    next = socket.assigns.page + 1
    results = if socket.assigns.filters.q == "" do
      IdeasService.list(socket.assigns.filters.category_id, socket.assigns.filters.sort, next)
    else
      IdeasSearchService.search(socket.assigns.filters.q, socket.assigns.filters.search_scope, next)
    end
    new_ideas = Enum.map(results.ideas, &IdeasEnrichmentService.enrich_card(&1, socket.assigns.categories))
    {:noreply, assign(socket, ideas: socket.assigns.ideas ++ new_ideas, page: next, has_next: results.has_next)}
  end

  @impl true
  def handle_event("create-idea", params, socket) do
    user_id = socket.assigns.user.user_id
    case IdeasService.create(user_id, params) do
      {:ok, idea_id} ->
        Phoenix.PubSub.broadcast(Elixirideaboard.PubSub, "ideas", {:new_idea, idea_id})
        {:noreply, assign(socket, show_create: false)}
      _ ->
        {:noreply, assign(socket, error: "Fehler beim Erstellen der Idee")}
    end
  end

  @impl true
  def handle_event("toggle-like", %{"id" => id}, socket) do
    {:ok, result} = ReactionsService.toggle_like(id, socket.assigns.user.user_id)
    Phoenix.PubSub.broadcast(Elixirideaboard.PubSub, "ideas", {:idea_updated, String.to_integer(id)})
    {:noreply, socket}
  end

  @impl true
  def handle_event("toggle-dislike", %{"id" => id}, socket) do
    {:ok, result} = ReactionsService.toggle_dislike(id, socket.assigns.user.user_id)
    Phoenix.PubSub.broadcast(Elixirideaboard.PubSub, "ideas", {:idea_updated, String.to_integer(id)})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:new_idea, idea_id}, socket) do
    {:ok, idea} = IdeasService.get(idea_id)
    idea = IdeasEnrichmentService.enrich_card(idea, socket.assigns.categories)
    {:noreply, assign(socket, ideas: [idea | socket.assigns.ideas])}
  end

  @impl true
  def handle_info({:idea_updated, idea_id}, socket) do
    {:ok, idea} = IdeasService.get(idea_id)
    if idea do
      idea = IdeasEnrichmentService.enrich_card(idea, socket.assigns.categories)
      idx = Enum.find_index(socket.assigns.ideas, &(&1.idea_id == idea_id))
      if idx do
        ideas = List.replace_at(socket.assigns.ideas, idx, idea)
        {:noreply, assign(socket, ideas: ideas)}
      else
        {:noreply, socket}
      end
    else
      {:noreply, socket}
    end
  end
end
