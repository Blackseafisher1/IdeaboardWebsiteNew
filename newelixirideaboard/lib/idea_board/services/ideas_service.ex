defmodule IdeaBoard.IdeasService do
  def list(_user, filters) do
    page = Map.get(filters, :page, 1)
    per_page = 20
    offset = (page - 1) * per_page
    category_id = filters[:category_id]

    sort_sql = case filters[:sort] do
      "oldest" -> "i.created_at ASC"
      "likes" -> "i.like_count DESC"
      "score" -> "i.score DESC"
      _ -> "i.created_at DESC"
    end

    {where_clause, params} = if category_id && category_id != "" do
      {"WHERE i.category_id = ?", [category_id]}
    else
      {"", []}
    end

    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT i.*, u.username AS author_username FROM ideas i JOIN users u ON u.user_id = i.user_id #{where_clause} ORDER BY #{sort_sql} LIMIT ? OFFSET ?",
      params ++ [per_page + 1, offset]
    )

    ideas = result.rows || []
    has_next = length(ideas) > per_page
    ideas = Enum.take(ideas, per_page)
    ideas = IdeaBoard.IdeasEnrichmentService.enrich_batch(ideas)

    %{ideas: ideas, has_next: has_next, page: page}
  end

  def fetch(idea_id) do
    IdeaBoard.Repo.query(
      "SELECT i.*, u.username AS author_username FROM ideas i JOIN users u ON u.user_id = i.user_id WHERE i.idea_id = ?",
      [idea_id]
    )
  end

  def create(user, data, _file \\ nil) do
    {:ok, result} = IdeaBoard.Repo.query(
      "INSERT INTO ideas (user_id, category_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
      [user.user_id, data[:category_id] || data["category_id"], data[:title] || data["title"], data[:description] || data["description"]]
    )
    idea_id = result.last_insert_id

    tags = data[:tags] || data["tags"] || ""
    if tags != "" do
      tag_list = String.split(tags, ",") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))
      IdeaBoard.IdeasTagsService.add_tags(idea_id, tag_list)
    end

    {:ok, %{idea_id: idea_id}}
  end

  def update(user, idea_id, data) do
    case fetch(idea_id) do
      {:ok, %{rows: [idea | _]}} ->
        if idea.user_id == user.user_id || IdeaBoard.RoleHelpers.is_admin?(user) do
          IdeaBoard.Repo.query(
            "UPDATE ideas SET title = ?, description = ?, category_id = ?, status = ?, updated_at = NOW() WHERE idea_id = ?",
            [
              data[:title] || data["title"] || idea.title,
              data[:description] || data["description"] || idea.description,
              data[:category_id] || data["category_id"] || idea.category_id,
              data[:status] || data["status"] || idea.status,
              idea_id
            ]
          )
          fetch(idea_id)
        else
          {:error, "Nicht berechtigt"}
        end

      _ -> {:error, "Idee nicht gefunden"}
    end
  end

  def delete(user, idea_id) do
    case fetch(idea_id) do
      {:ok, %{rows: [idea | _]}} ->
        if idea.user_id == user.user_id || IdeaBoard.RoleHelpers.is_admin?(user) do
          IdeaBoard.Repo.query("DELETE FROM ideas WHERE idea_id = ?", [idea_id])
          :ok
        else
          {:error, "Nicht berechtigt"}
        end

      _ -> {:error, "Idee nicht gefunden"}
    end
  end
end
