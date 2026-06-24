defmodule IdeaBoard.IdeasTagsService do
  def add_tags(idea_id, tags) do
    try do
      for tag <- tags do
        IdeaBoard.Repo.query("INSERT IGNORE INTO tags (name) VALUES (?)", [tag])
        case IdeaBoard.Repo.query_map("SELECT tag_id FROM tags WHERE name = ?", [tag]) do
          {:ok, %{"tag_id" => tag_id}} ->
            IdeaBoard.Repo.query("INSERT IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)", [idea_id, tag_id])
          _ -> :ok
        end
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> :ok
    end
  end

  def get_tags(idea_id) do
    try do
      {:ok, rows} = IdeaBoard.Repo.query_maps(
        "SELECT t.name FROM idea_tags it JOIN tags t ON t.tag_id = it.tag_id WHERE it.idea_id = ?",
        [idea_id]
      )
      Enum.map(rows || [], fn %{"name" => name} -> %{name: name} end)
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end
end
