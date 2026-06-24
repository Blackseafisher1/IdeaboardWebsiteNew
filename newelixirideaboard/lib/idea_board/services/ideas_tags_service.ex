defmodule IdeaBoard.IdeasTagsService do
  def add_tags(idea_id, tags) do
    for tag <- tags do
      IdeaBoard.Repo.query("INSERT IGNORE INTO tags (name) VALUES (?)", [tag])
      {:ok, result} = IdeaBoard.Repo.query("SELECT tag_id FROM tags WHERE name = ?", [tag])
      if result.rows != [] do
        tag_id = result.rows[0][0]
        IdeaBoard.Repo.query("INSERT IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)", [idea_id, tag_id])
      end
    end
  end

  def get_tags(idea_id) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT t.name FROM idea_tags it JOIN tags t ON t.tag_id = it.tag_id WHERE it.idea_id = ?",
      [idea_id]
    )
    Enum.map(result.rows || [], fn [name] -> %{name: name} end)
  end
end
