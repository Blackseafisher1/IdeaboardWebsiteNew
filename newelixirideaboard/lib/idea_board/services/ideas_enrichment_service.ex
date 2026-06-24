defmodule IdeaBoard.IdeasEnrichmentService do
  def enrich_batch(ideas) do
    idea_ids = Enum.map(ideas, & &1.idea_id)
    tags = fetch_tags(idea_ids)
    files = fetch_files(idea_ids)

    Enum.map(ideas, fn idea ->
      idea
      |> Map.put(:tags, Map.get(tags, idea.idea_id, []))
      |> Map.put(:files, Map.get(files, idea.idea_id, []))
    end)
  end

  defp fetch_tags(idea_ids) when idea_ids == [], do: %{}
  defp fetch_tags(idea_ids) do
    placeholders = Enum.map(idea_ids, fn _ -> "?" end) |> Enum.join(",")
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT it.idea_id, t.name AS tag_name FROM idea_tags it JOIN tags t ON t.tag_id = it.tag_id WHERE it.idea_id IN (#{placeholders})",
      idea_ids
    )
    (result.rows || [])
    |> Enum.group_by(fn [idea_id, _] -> idea_id end, fn [_, tag_name] -> %{name: tag_name} end)
  end

  defp fetch_files(idea_ids) when idea_ids == [], do: %{}
  defp fetch_files(idea_ids) do
    placeholders = Enum.map(idea_ids, fn _ -> "?" end) |> Enum.join(",")
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT idea_id, filename, original_name, mimetype FROM idea_files WHERE idea_id IN (#{placeholders})",
      idea_ids
    )
    (result.rows || [])
    |> Enum.group_by(fn [idea_id, _, _, _] -> idea_id end, fn [_, filename, orig, mime] ->
      %{filename: filename, original_name: orig, mimetype: mime}
    end)
  end
end
