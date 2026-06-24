defmodule Elixirideaboard.Router do
  use Elixirideaboard.Web, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, {Elixirideaboard.Components.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  scope "/", Elixirideaboard do
    pipe_through [:browser]

    get "/", PageController, :index
    get "/gate", PageController, :gate
    post "/gate", PageController, :gate_post
    get "/healthz", PageController, :health
    get "/impressum", PageController, :static_page
    get "/datenschutz", PageController, :static_page
    get "/agb", PageController, :static_page
    get "/kontakt", PageController, :static_page

    post "/auth/login", AuthController, :login
    get "/auth/logout", AuthController, :logout
    get "/auth/set-session", AuthController, :set_session

    live_session :public do
      live "/users/auth", AuthLive, :auth
    end

    live_session :authenticated, on_mount: [
      {Elixirideaboard.Live.AuthMount, :mount_user},
      {Elixirideaboard.Live.AuthMount, :require_user}
    ] do
      live "/ideas", IdeasLive, :index
      live "/dms", ChatLive, :inbox
      live "/dms/chat/:user_id", ChatLive, :direct
      live "/groups/chat/:id", ChatLive, :group
      live "/dashboard", DashboardLive, :index
      live "/surveys", SurveyLive, :index
      live "/surveys/new", SurveyLive, :new
      live "/surveys/:id", SurveyLive, :show
      live "/projects", ProjectLive, :index
      live "/account", AuthLive, :account
    end

    live_session :admin, on_mount: [
      {Elixirideaboard.Live.AuthMount, :mount_user},
      {Elixirideaboard.Live.AuthMount, :require_admin}
    ] do
      live "/admin", AdminLive, :index
    end

    get "/ideas/files/:file_id/download", FileController, :idea_download
    get "/dms/file/:conversation_id/:filename", FileController, :dm_download
    get "/groups/file/:group_id/:filename", FileController, :group_download
  end
end
