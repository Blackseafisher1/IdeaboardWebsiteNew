defmodule IdeaBoard.CategoriesService do
  def all do
    try do
      case IdeaBoard.Repo.query_maps("SELECT * FROM categories ORDER BY name ASC") do
        {:ok, maps} -> maps
        _ -> []
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end
end
