defmodule Elixirideaboard.PointsService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/points.sql")

  def get(user_id) do
    case get_points(user_id: user_id) do
      {:ok, [%{points: pts}]} -> pts
      _ -> 0
    end
  end

  def add(user_id, points) do
    add_points(user_id: user_id, points: points)
  end

  def deduct(user_id, points) do
    deduct_points(user_id: user_id, points: points)
  end
end
