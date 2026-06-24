defmodule Elixirideaboard.E2E.AuthTest do
  use ExUnit.Case, async: false

  setup do
    # Use the already running app from mix test
    :ok
  end

  test "login flow with valid admin credentials" do
    user = Elixirideaboard.AuthService.login("admin", "admin")
    assert {:ok, user} = user
    assert user.username == "admin"
    assert user.role_name == "Admin"
  end

  test "login with wrong password returns error" do
    assert {:error, :invalid_credentials} = Elixirideaboard.AuthService.login("admin", "wrongpassword")
  end

  test "user service returns enriched user with role_name" do
    user = Elixirideaboard.UserService.get(1)
    assert user != nil
    assert user.role_name == "Admin"
    assert user.role_id == 1
  end

  test "ideas_service lists ideas" do
    result = Elixirideaboard.IdeasService.list(nil, "latest", 1, 5)
    assert Map.has_key?(result, :ideas)
    assert Map.has_key?(result, :total)
    assert result.page == 1
  end

  test "categories_service returns all" do
    cats = Elixirideaboard.CategoriesService.all()
    assert is_list(cats)
    assert length(cats) > 0
  end

  test "dashboard metrics" do
    metrics = Elixirideaboard.DashboardService.metrics()
    assert Map.has_key?(metrics, :total_ideas)
    assert metrics.total_ideas > 0
  end

  test "role helpers detect admin" do
    user = Elixirideaboard.UserService.get(1)
    assert Elixirideaboard.RoleHelpers.is_admin?(user)
  end
end
