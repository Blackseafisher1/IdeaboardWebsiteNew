defmodule Elixirideaboard.Presence do
  use Phoenix.Presence,
    otp_app: :elixirideaboard,
    pubsub_server: Elixirideaboard.PubSub
end
