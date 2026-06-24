defmodule Elixirideaboard.IdeasEnrichmentService do
  def normalize_author(ideas) when is_list(ideas) do
    Enum.map(ideas, &normalize_author/1)
  end

  def normalize_author(idea) do
    Map.put(idea, :author, idea[:author_username] || idea[:username] || "Unbekannt")
  end

  def enrich_card(idea, categories) do
    cat = Enum.find(categories, fn c -> c.category_id == idea.category_id end)
    idea
    |> normalize_author()
    |> Map.put(:category_name, if(cat, do: cat.name, else: "—"))
  end
end
