defmodule Elixirideaboard.PageController do
  use Elixirideaboard.Web, :controller

  def index(conn, _params) do
    render(conn, :index, layout: {Elixirideaboard.Components.Layouts, :root})
  end

  def gate(conn, params) do
    back = params["back"] || "/"
    render(conn, :gate, back: back, error: nil, layout: {Elixirideaboard.Components.Layouts, :root})
  end

  def gate_post(conn, params) do
    password = params["password"] || ""
    back = params["back"] || "/"

    case Application.get_env(:elixirideaboard, :public_gate_password, "") do
      pw when pw in [nil, ""] ->
        redirect(conn, to: back)
      pw ->
        if password == pw do
          conn
          |> put_session(:gate_passed, true)
          |> redirect(to: back)
        else
          render(conn, :gate, back: back, error: "Falsches Passwort", layout: {Elixirideaboard.Components.Layouts, :root})
        end
    end
  end

  def health(conn, _params) do
    db_status = case Elixirideaboard.Repo.query("SELECT 1 AS ok") do
      {:ok, _} -> "ok"
      _ -> "error"
    end

    json(conn, %{ok: db_status == "ok", db: db_status, app: "elixirideaboard"})
  end

  def static_page(conn, _params) do
    page = conn.request_path |> String.trim("/")
    render(conn, String.to_atom(page), layout: {Elixirideaboard.Components.Layouts, :root})
  end
end
