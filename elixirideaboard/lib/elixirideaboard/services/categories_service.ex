defmodule Elixirideaboard.CategoriesService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/categories.sql")

  def all do
    case list_categories(%{}) do
      {:ok, cats} -> cats
      _ -> []
    end
  end

  def get(id) do
    case get_category(id: id) do
      {:ok, [cat]} -> cat
      _ -> nil
    end
  end
end
