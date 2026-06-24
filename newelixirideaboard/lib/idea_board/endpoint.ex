defmodule IdeaBoard.Endpoint do
  use Plug.Builder

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:ideaboard, :endpoint]

  plug Plug.Static,
    at: "/",
    from: {:newelixirideaboard, "priv/static"},
    gzip: true,
    cache_control_for_etags: "public, max-age=86400",
    only: ~w(css js assets favicon.ico robots.txt)

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason

  plug Plug.MethodOverride
  plug Plug.Head

  plug Plug.Session,
    store: :cookie,
    key: "_ideaboard_session",
    signing_salt: Application.compile_env(:newelixirideaboard, :session_salt, "abcdefgh"),
    encrypt: true,
    max_age: 86_400

  plug IdeaBoard.Router
end
