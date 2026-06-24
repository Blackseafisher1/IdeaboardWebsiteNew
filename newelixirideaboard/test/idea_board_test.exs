defmodule IdeaBoardTest do
  use ExUnit.Case, async: true
  import Plug.Test

  @opts IdeaBoard.Endpoint.init([])

  test "healthz" do
    conn = :get |> conn("/healthz") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "index" do
    conn = :get |> conn("/") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
    assert conn.resp_body =~ "Ideenboard"
  end

  test "impressum" do
    conn = :get |> conn("/impressum") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "login form" do
    conn = :get |> conn("/users/auth") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
    assert conn.resp_body =~ "Login"
    assert conn.resp_body =~ "Registrieren"
    assert conn.resp_body =~ "auth-card"
  end

  test "login missing fields" do
    conn = :post |> conn("/users/auth", %{}) |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 400
  end

  test "logout" do
    conn = :get |> conn("/auth/logout") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 302
  end

  test "gate" do
    conn = :get |> conn("/gate") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
    assert conn.resp_body =~ "Zugangscode"
  end

  test "404" do
    conn = :get |> conn("/nonexistent") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 404
  end

  test "static css" do
    conn = :get |> conn("/css/style.css") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "static js" do
    conn = :get |> conn("/js/auth-flip.js") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "static img" do
    conn = :get |> conn("/assets/logo.png") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "admin 403" do
    conn = :get |> conn("/admin") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 403
  end

  test "ideas page renders when not logged in" do
    conn = :get |> conn("/ideas") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
    assert conn.resp_body =~ "Ideen"
  end

  test "account page redirects when not logged in" do
    conn = :get |> conn("/users/account") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 302
  end

  test "projects page renders when not logged in" do
    conn = :get |> conn("/projects") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "surveys page renders when not logged in" do
    conn = :get |> conn("/surveys") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 200
  end

  test "dashboard page redirects when not logged in" do
    conn = :get |> conn("/dashboard") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 302
  end

  test "dms page redirects when not logged in" do
    conn = :get |> conn("/dms") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 302
  end

  test "groups page redirects when not logged in" do
    conn = :get |> conn("/groups") |> IdeaBoard.Endpoint.call(@opts)
    assert conn.status == 302
  end
end
