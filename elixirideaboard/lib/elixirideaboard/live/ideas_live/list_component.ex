defmodule Elixirideaboard.IdeasLive.ListComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <div class="ideas-grid" id="ideas-list" phx-update="stream">
      <%= for idea <- @ideas do %>
        <.live_component module={Elixirideaboard.IdeasLive.CardComponent} id={"idea-card-#{idea.idea_id}"} idea={idea} user={@user} />
      <% end %>
    </div>
    <%= if @has_next do %>
      <div class="load-more" phx-click="load-more" phx-throttle="200">Mehr laden...</div>
    <% end %>
    """
  end
end
