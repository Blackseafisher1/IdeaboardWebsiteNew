import Config

config :jason, :decoder, Jason

config :phoenix_template, :template_engines,
  heex: Phoenix.Template.EExEngine,
  eex: Phoenix.Template.EExEngine

config :phoenix_template, :format_encoders,
  html: Phoenix.HTML.Engine,
  heex: Phoenix.HTML.Engine

config :phoenix_html,
  simplified_encoding: true

config :newelixirideaboard,
  db_pool_size: 10

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

import_config "#{config_env()}.exs"
