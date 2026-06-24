defmodule Elixirideaboard.ProjectLive do
  use Elixirideaboard.Web, :live_view

  alias Elixirideaboard.ProjectService

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, projects: ProjectService.list())}
  end
end
