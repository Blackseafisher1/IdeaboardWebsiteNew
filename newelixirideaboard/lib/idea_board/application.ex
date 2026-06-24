defmodule IdeaBoard.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      IdeaBoard.Repo,
      IdeaBoard.PubSub,
      {Bandit, plug: IdeaBoard.Endpoint, port: Application.get_env(:newelixirideaboard, :port, 4000)}
    ]

    opts = [strategy: :one_for_one, name: IdeaBoard.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
