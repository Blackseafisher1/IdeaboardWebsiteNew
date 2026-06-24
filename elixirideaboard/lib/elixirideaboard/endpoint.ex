defmodule Elixirideaboard.Endpoint do
  use Phoenix.Endpoint, otp_app: :elixirideaboard

  socket "/live", Phoenix.LiveView.Socket

  plug Plug.Static,
    at: "/",
    from: {:elixirideaboard, "priv/static"},
    gzip: true,
    cache_control_for_etags: "public, max-age=86400",
    only: ~w(css js assets favicon.ico robots.txt)

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason

  plug Plug.MethodOverride
  plug Plug.Head

  plug Plug.Session,
    store: :cookie,
    key: "_ideaboard_session",
    signing_salt: Application.compile_env(:elixirideaboard, :session_salt, "abcdefgh"),
    encrypt: true,
    max_age: 86_400

  plug Elixirideaboard.Router
end
