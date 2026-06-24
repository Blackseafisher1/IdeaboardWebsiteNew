defmodule Elixirideaboard.IdeasCommentsService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas_comments.sql")

  def list(idea_id) do
    case list_comments(idea_id: idea_id) do
      {:ok, rows} -> rows
      _ -> []
    end
  end

  def create(idea_id, user_id, text) do
    case create_comment(idea_id: idea_id, user_id: user_id, text: text) do
      {:ok, %{last_insert_id: id}} -> get(id)
      error -> error
    end
  end

  def update(id, user_id, text) do
    update_comment(id: id, user_id: user_id, text: text)
  end

  def delete(id) do
    delete_comment(id: id)
  end

  def get(id) do
    case get_comment_by_id(id: id) do
      {:ok, [comment]} -> comment
      _ -> nil
    end
  end
end
