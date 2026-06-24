defmodule Elixirideaboard.IdeasLive.FilterComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <form phx-change="filter" phx-debounce="500" class="filter-form">
      <div class="search-field">
        <input type="text" name="q" value={@filters.q} placeholder="Suche..." class="input" />
      </div>
      <div class="filter-row">
        <select name="category_id" class="input">
          <option value="">Alle Kategorien</option>
          <%= for cat <- @categories do %>
            <option value={cat.category_id} selected={@filters.category_id == cat.category_id}><%= cat.name %></option>
          <% end %>
        </select>
        <select name="sort" class="input">
          <option value="latest" selected={@filters.sort == "latest"}>Neueste zuerst</option>
          <option value="oldest" selected={@filters.sort == "oldest"}>Älteste zuerst</option>
          <option value="likes" selected={@filters.sort == "likes"}>Meiste Likes</option>
          <option value="comments" selected={@filters.sort == "comments"}>Meiste Kommentare</option>
          <option value="score" selected={@filters.sort == "score"}>Nur Score</option>
        </select>
        <select name="owned_only" class="input">
          <option value="false" selected={!@filters.owned_only}>Alle Ideen</option>
          <option value="true" selected={@filters.owned_only}>Meine Ideen</option>
        </select>
        <input type="text" name="tags" value={@filters.tags} placeholder="Tags" class="input" />
      </div>
    </form>
    """
  end
end
