defmodule IdeaBoard.PubSub do
  use GenServer

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def subscribe(topic) when is_binary(topic) do
    subscribe(String.to_atom(topic))
  end

  def subscribe(topic) when is_atom(topic) do
    :pg.join(topic, self())
    :ok
  end

  def unsubscribe(topic) when is_binary(topic) do
    unsubscribe(String.to_atom(topic))
  end

  def unsubscribe(topic) when is_atom(topic) do
    :pg.leave(topic, self())
    :ok
  end

  def broadcast(topic, message) when is_binary(topic) do
    broadcast(String.to_atom(topic), message)
  end

  def broadcast(topic, message) when is_atom(topic) do
    members = :pg.get_members(topic)
    for pid <- members do
      send(pid, {:"$pubsub", topic, message})
    end
    :ok
  end

  @impl true
  def init(_opts) do
    {:ok, %{}}
  end
end
