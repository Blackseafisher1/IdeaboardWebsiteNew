import Config

config :elixirideaboard, :dev_routes, false

config :elixirideaboard, Elixirideaboard.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: String.to_integer(System.get_env("PORT", "4000"))],
  url: [host: System.get_env("HOST", "localhost"), port: 443],
  cache_static_manifest: "priv/static/cache_manifest.json",
  server: true
