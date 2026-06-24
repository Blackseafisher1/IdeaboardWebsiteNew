defmodule Elixirideaboard.IdeasTagsService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas_tags.sql")

  def list(idea_id) do
    case list_idea_tags(idea_id: idea_id) do
      {:ok, tags} -> Enum.map(tags, & &1.name)
      _ -> []
    end
  end

  def add_tags(idea_id, tags_string) do
    tags = tags_string |> String.split(",") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))

    Enum.each(tags, fn tag_name ->
      name = String.downcase(tag_name)
      case find_tag_by_name(name: name) do
        {:ok, [tag]} -> link_tag_to_idea(idea_id: idea_id, tag_id: tag.tag_id)
        _ ->
          create_tag(name: name)
          {:ok, [tag]} = find_tag_by_name(name: name)
          link_tag_to_idea(idea_id: idea_id, tag_id: tag.tag_id)
      end
    end)

    :ok
  end

  def remove_tag(idea_id, tag_name) do
    name = String.downcase(tag_name)
    case find_tag_by_name(name: name) do
      {:ok, [tag]} -> unlink_tag_from_idea(idea_id: idea_id, tag_id: tag.tag_id)
      _ -> {:error, :not_found}
    end
  end
end
