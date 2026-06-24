defmodule Elixirideaboard.PageCache do
  @moduledoc """
  ETS-based in-memory page cache with TTL.
  Replaces lib/cacheHelper.js + Redis page caching.
  """

  use GenServer

  @table :page_cache

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get(key) do
    case :ets.lookup(@table, key) do
      [{^key, value, expires}] ->
        if expires > System.system_time(:second) do
          {:ok, value}
        else
          :ets.delete(@table, key)
          :miss
        end
      [] -> :miss
    end
  end

  def put(key, value, ttl_seconds) do
    expires = System.system_time(:second) + ttl_seconds
    :ets.insert(@table, {key, value, expires})
    :ok
  end

  def delete(key) do
    :ets.delete(@table, key)
    :ok
  end

  def get_or_store(key, ttl_seconds, fun) do
    case get(key) do
      {:ok, value} -> value
      :miss ->
        value = fun.()
        put(key, value, ttl_seconds)
        value
    end
  end

  def flush do
    :ets.delete_all_objects(@table)
    :ok
  end

  # GenServer

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, %{}, {:continue, :start_cleaner}}
  end

  @impl true
  def handle_continue(:start_cleaner, state) do
    schedule_clean()
    {:noreply, state}
  end

  @impl true
  def handle_info(:clean, state) do
    now = System.system_time(:second)
    expired =
      @table
      |> :ets.tab2list()
      |> Enum.filter(fn {_k, _v, expires} -> expires <= now end)
      |> Enum.map(fn {k, _, _} -> k end)

    Enum.each(expired, &:ets.delete(@table, &1))
    schedule_clean()
    {:noreply, state}
  end

  defp schedule_clean do
    Process.send_after(self(), :clean, 60_000)
  end
end
