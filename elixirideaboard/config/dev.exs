import Config

config :phoenix, :stacktrace_depth, 20
config :phoenix, :plug_init_mode, :runtime

config :elixirideaboard, :dev_routes, true

config :elixirideaboard, Elixirideaboard.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: false,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_64_chars_minimum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  live_view: [signing_salt: "abcdefgh1234567890"],
  watchers: []
