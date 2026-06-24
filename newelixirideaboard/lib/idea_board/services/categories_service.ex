defmodule IdeaBoard.CategoriesService do
  def all do
    {:ok, result} = IdeaBoard.Repo.query("SELECT * FROM categories ORDER BY name ASC")
    result.rows || []
  end
end
