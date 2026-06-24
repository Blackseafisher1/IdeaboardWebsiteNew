defmodule Elixirideaboard.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      Elixirideaboard.Repo,
      {Phoenix.PubSub, name: Elixirideaboard.PubSub},
      Elixirideaboard.Presence,
      Elixirideaboard.PageCache,
      Elixirideaboard.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Elixirideaboard.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    Elixirideaboard.Endpoint.config_change(changed, removed)
    :ok
  end
end
