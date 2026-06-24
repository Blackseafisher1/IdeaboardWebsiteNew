defmodule Elixirideaboard.IdeasLive.StatsComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <div class="idea-stats" id={"idea-stats-#{@idea.idea_id}"}>
      <button class="btn-like" phx-click="toggle-like" phx-value-id={@idea.idea_id}>
        👍 <%= @idea.like_count || 0 %>
      </button>
      <button class="btn-dislike" phx-click="toggle-dislike" phx-value-id={@idea.idea_id}>
        👎 <%= @idea.dislike_count || 0 %>
      </button>
    </div>
    """
  end
end
