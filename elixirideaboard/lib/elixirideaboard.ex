defmodule Elixirideaboard do
  @moduledoc """
  Ideaboard — a digital idea board with real-time collaboration.
  Migrated from Node/Express/EJS/HTMX to Elixir/Phoenix/LiveView.

  Key design decisions:
  - MariaDB + raw SQL via AyeSQL (no Ecto)
  - Phoenix LiveView for all interactivity (no HTMX, no SSE)
  - Phoenix PubSub + Presence instead of Redis pub/sub
  - Cookie sessions instead of MariaDB session store
  - ETS for page caching (no Redis cache)
  - Erlang distribution for multi-node (no external message broker)
  """
end
