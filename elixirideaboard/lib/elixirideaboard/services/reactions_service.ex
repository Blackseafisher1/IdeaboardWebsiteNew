defmodule Elixirideaboard.ReactionsService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas_reactions.sql")

  def toggle_like(idea_id, user_id) do
    case user_reaction(idea_id: idea_id, user_id: user_id) do
      {:ok, [%{reaction_type: "like"}]} ->
        toggle_like_reaction(idea_id: idea_id, user_id: user_id)
        {:ok, %{liked: false}}
      _ ->
        toggle_like_reaction(idea_id: idea_id, user_id: user_id)
        {:ok, %{liked: true}}
    end
  end

  def toggle_dislike(idea_id, user_id) do
    case user_reaction(idea_id: idea_id, user_id: user_id) do
      {:ok, [%{reaction_type: "dislike"}]} ->
        toggle_dislike_reaction(idea_id: idea_id, user_id: user_id)
        {:ok, %{disliked: false}}
      _ ->
        toggle_dislike_reaction(idea_id: idea_id, user_id: user_id)
        {:ok, %{disliked: true}}
    end
  end

  def get_counts(idea_id) do
    {:ok, [%{count: likes}]} = get_idea_likes(idea_id: idea_id)
    {:ok, [%{count: dislikes}]} = get_idea_dislikes(idea_id: idea_id)
    %{likes: likes, dislikes: dislikes}
  end
end
