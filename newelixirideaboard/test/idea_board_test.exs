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
end
