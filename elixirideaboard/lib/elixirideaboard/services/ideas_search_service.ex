defmodule Elixirideaboard.IdeasSearchService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas_search.sql")

  def search(query, scope, page, per \\ 20) do
    offset = (page - 1) * per

    case scope do
      "description" ->
        {:ok, rows} = search_description(query: query, limit: per, offset: offset)
        {:ok, [%{total: total}]} = search_description_count(query: query)
        %{ideas: rows, total: total, page: page, has_next: (offset + per) < total}

      _ ->
        # Try FULLTEXT title search first
        {:ok, rows} = search_title(query: build_boolean(query), limit: per, offset: offset)
        {:ok, [%{total: total}]} = search_title_count(query: build_boolean(query))

        if total == 0 do
          # Fall back to LIKE search
          {:ok, rows} = search_author_like(query: query, query_exact: query, limit: per, offset: offset)
          {:ok, [%{total: total}]} = search_author_like_count(query: query, query_exact: query)
        end

        %{ideas: rows, total: total, page: page, has_next: (offset + per) < total}
    end
  end

  defp build_boolean(raw) do
    raw
    |> String.split(~r/[\s,.;:!?|\/-]+/)
    |> Enum.reject(&(&1 == ""))
    |> Enum.map(fn t -> if String.length(t) > 2, do: "#{t}*", else: t end)
    |> Enum.join(" ")
  end
end
