defmodule Elixirideaboard.DashboardService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/dashboard.sql")

  def metrics do
    case dashboard_metrics(%{}) do
      {:ok, [metrics]} -> metrics
      _ -> %{new_ideas: 0, new_users: 0, total_ideas: 0, total_users: 0}
    end
  end

  def top_ideas_list(limit \\ 5) do
    case top_ideas(limit: limit) do
      {:ok, ideas} -> ideas
      _ -> []
    end
  end
end
