defmodule Elixirideaboard.IdeasStatsService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas_stats.sql")

  def get_weekly_remaining(user_id) do
    week_start = Date.utc_today() |> Date.beginning_of_week()
    case weekly_remaining(user_id: user_id, week_start: week_start) do
      {:ok, [stats]} -> stats
      _ -> %{remaining_likes: 10, remaining_dislikes: 5}
    end
  end
end
