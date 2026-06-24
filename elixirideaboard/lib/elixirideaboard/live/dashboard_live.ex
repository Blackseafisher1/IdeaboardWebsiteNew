defmodule Elixirideaboard.DashboardLive do
  use Elixirideaboard.Web, :live_view

  alias Elixirideaboard.DashboardService

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket,
      metrics: DashboardService.metrics(),
      top_ideas: DashboardService.top_ideas_list(5)
    )}
  end

  @impl true
  def handle_params(_params, _url, socket) do
    {:noreply, assign(socket,
      metrics: DashboardService.metrics(),
      top_ideas: DashboardService.top_ideas_list(5)
    )}
  end

  @impl true
  def handle_event("refresh", _, socket) do
    {:noreply, assign(socket,
      metrics: DashboardService.metrics(),
      top_ideas: DashboardService.top_ideas_list(5)
    )}
  end
end
