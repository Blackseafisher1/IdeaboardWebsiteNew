import Config

config :jason, :decoder, Jason

config :phoenix_template, :format_encoders,
  heex: Phoenix.HTML.Engine

config :phoenix_html,
  simplified_encoding: true

config :newelixirideaboard,
  db_pool_size: 10

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

import_config "#{config_env()}.exs"
