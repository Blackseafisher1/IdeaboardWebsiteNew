defmodule IdeaBoard.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/healthz" do
    send_resp(conn, 200, Jason.encode!(%{ok: true}))
  end

  get "/gate" do
    IdeaBoard.PageController.call(conn, :gate)
  end

  post "/gate" do
    IdeaBoard.PageController.call(conn, :gate_post)
  end

  get "/users/auth" do
    IdeaBoard.AuthController.call(conn, :login_form)
  end

  post "/users/auth" do
    IdeaBoard.AuthController.call(conn, :login)
  end

  post "/users/register" do
    IdeaBoard.AuthController.call(conn, :register)
  end

  get "/auth/logout" do
    IdeaBoard.AuthController.call(conn, :logout)
  end

  get "/impressum" do
    IdeaBoard.PageController.call(conn, :static_page)
  end

  get "/datenschutz" do
    IdeaBoard.PageController.call(conn, :static_page)
  end

  get "/agb" do
    IdeaBoard.PageController.call(conn, :static_page)
  end

  get "/kontakt" do
    IdeaBoard.PageController.call(conn, :static_page)
  end

  get "/users/account" do
    IdeaBoard.UserController.call(conn, :index)
  end

  post "/users/account" do
    IdeaBoard.UserController.call(conn, :update_profile)
  end

  post "/users/password" do
    IdeaBoard.UserController.call(conn, :change_password)
  end

  get "/ideas" do
    IdeaBoard.IdeasController.call(conn, :index)
  end

  post "/ideas" do
    IdeaBoard.IdeasController.call(conn, :create)
  end

  post "/ideas/:idea_id/edit" do
    IdeaBoard.IdeasController.call(conn, :edit)
  end

  post "/ideas/:idea_id/delete" do
    IdeaBoard.IdeasController.call(conn, :delete)
  end

  post "/ideas/:idea_id/like" do
    IdeaBoard.IdeasController.call(conn, :like)
  end

  get "/ideas/:idea_id/stats" do
    IdeaBoard.IdeasController.call(conn, :stats)
  end

  get "/ideas/chunk" do
    IdeaBoard.IdeasController.call(conn, :chunk)
  end

  get "/ideas/files/:file_id/download" do
    IdeaBoard.FileController.call(conn, :idea_download)
  end

  get "/dms" do
    IdeaBoard.DmsController.call(conn, :index)
  end

  get "/dms/file/:conversation_id/:filename" do
    IdeaBoard.FileController.call(conn, :dm_download)
  end

  get "/groups" do
    IdeaBoard.GroupsController.call(conn, :index)
  end

  get "/groups/file/:group_id/:filename" do
    IdeaBoard.FileController.call(conn, :group_download)
  end

  get "/projects" do
    IdeaBoard.ProjectsController.call(conn, :index)
  end

  get "/surveys" do
    IdeaBoard.SurveysController.call(conn, :index)
  end

  get "/dashboard" do
    IdeaBoard.DashboardController.call(conn, :index)
  end

  get "/admin" do
    IdeaBoard.AdminController.call(conn, :index)
  end

  get "/" do
    IdeaBoard.PageController.call(conn, :index)
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
