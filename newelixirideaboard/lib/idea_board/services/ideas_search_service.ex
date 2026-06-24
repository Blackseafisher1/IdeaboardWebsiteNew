defmodule IdeaBoard.IdeasSearchService do
  def search(_user, query, page \\ 1) do
    per_page = 20
    offset = (page - 1) * per_page
    search_term = "#{query}*"

    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT i.*, u.username AS author_username, MATCH(s.title) AGAINST(? IN BOOLEAN MODE) AS relevance FROM ideas_search s JOIN ideas i ON i.idea_id = s.idea_id JOIN users u ON u.user_id = i.user_id WHERE MATCH(s.title) AGAINST(? IN BOOLEAN MODE) ORDER BY relevance DESC LIMIT ? OFFSET ?",
      [search_term, search_term, per_page + 1, offset]
    )

    title_results = result.rows || []

    results = if length(title_results) < per_page + 1 do
      remaining = per_page + 1 - length(title_results)
      {:ok, result2} = IdeaBoard.Repo.query(
        "SELECT i.*, u.username AS author_username FROM ideas_search s JOIN ideas i ON i.idea_id = s.idea_id JOIN users u ON u.user_id = i.user_id WHERE MATCH(s.description) AGAINST(? IN BOOLEAN MODE) OR s.tags LIKE CONCAT('%', ?, '%') ORDER BY i.created_at DESC LIMIT ? OFFSET ?",
        [query, query, remaining, offset]
      )
      title_results ++ (result2.rows || [])
    else
      title_results
    end

    trimmed = Enum.take(results, per_page)
    enriched = IdeaBoard.IdeasEnrichmentService.enrich_batch(trimmed)
    %{ideas: enriched, has_next: length(results) > per_page, page: page}
  end
end
