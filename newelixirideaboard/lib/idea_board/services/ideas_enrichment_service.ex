defmodule IdeaBoard.IdeasEnrichmentService do
  def enrich_batch(ideas) do
    idea_ids = Enum.map(ideas, fn idea -> idea[:idea_id] end)
    tags = fetch_tags(idea_ids)
    files = fetch_files(idea_ids)

    Enum.map(ideas, fn idea ->
      idea
      |> Map.put(:tags, Map.get(tags, idea[:idea_id], []))
      |> Map.put(:files, Map.get(files, idea[:idea_id], []))
    end)
  end

  defp fetch_tags(idea_ids) when idea_ids == [], do: %{}
  defp fetch_tags(idea_ids) do
    try do
      placeholders = Enum.map(idea_ids, fn _ -> "?" end) |> Enum.join(",")
      case IdeaBoard.Repo.query_maps(
             "SELECT it.idea_id, t.name AS tag_name FROM idea_tags it JOIN tags t ON t.tag_id = it.tag_id WHERE it.idea_id IN (#{placeholders})",
             idea_ids
           ) do
        {:ok, rows} ->
          (rows || [])
          |> Enum.group_by(fn map -> map[:idea_id] end, fn map -> %{name: map[:tag_name]} end)
        _ -> %{}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> %{}
    end
  end

  defp fetch_files(idea_ids) when idea_ids == [], do: %{}
  defp fetch_files(idea_ids) do
    try do
      placeholders = Enum.map(idea_ids, fn _ -> "?" end) |> Enum.join(",")
      case IdeaBoard.Repo.query_maps(
             "SELECT idea_id, filename, original_name, mimetype FROM idea_files WHERE idea_id IN (#{placeholders})",
             idea_ids
           ) do
        {:ok, rows} ->
          (rows || [])
          |> Enum.group_by(fn map -> map[:idea_id] end, fn map ->
            %{filename: map[:filename], original_name: map[:original_name], mimetype: map[:mimetype]}
          end)
        _ -> %{}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> %{}
    end
  end
end
