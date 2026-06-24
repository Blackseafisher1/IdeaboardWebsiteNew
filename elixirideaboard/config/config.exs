import Config

config :phoenix, :json_library, Jason

config :phoenix, :template_engines,
  heex: Phoenix.LiveView.Engine

config :phoenix, :filter_parameters, ["password", "session"]

config :elixirideaboard, Elixirideaboard.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: Elixirideaboard.ErrorHTML, json: Elixirideaboard.ErrorJSON],
    layout: false
  ],
  pubsub_server: Elixirideaboard.PubSub,
  live_view: [signing_salt: "abcdefgh1234567890"]

config :elixirideaboard,
  db_pool_size: 10

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :gettext, :default_locale, "de"

import_config "#{config_env()}.exs"
