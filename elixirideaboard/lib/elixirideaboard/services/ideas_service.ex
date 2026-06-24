defmodule Elixirideaboard.IdeasService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas.sql")

  def list(category_id, sort, page, per \\ 20) do
    offset = (page - 1) * per
    {:ok, rows} = list_ideas(category_id: category_id, sort: sort || "latest", limit: per, offset: offset, owned_only: 0, user_id: 0)
    {:ok, [%{total: total}]} = count_ideas(category_id: category_id, owned_only: 0, user_id: 0)
    %{ideas: rows, total: total, page: page, has_next: (offset + per) < total}
  end

  def get(id) do
    case get_idea_by_id(id: id) do
      {:ok, [idea]} -> {:ok, idea}
      {:ok, []} -> {:error, :not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  def create(user_id, attrs, file \\ nil) do
    case create_idea(
      user_id: user_id,
      title: attrs.title,
      description: attrs.description,
      category_id: attrs.category_id
    ) do
      {:ok, %{last_insert_id: id}} ->
        if file, do: IdeasFilesService.save(id, user_id, file)
        {:ok, id}
      {:error, reason} -> {:error, reason}
    end
  end

  def update(id, user_id, attrs) do
    if owner?(id, user_id) do
      update_idea(id: id, user_id: user_id, title: attrs.title, description: attrs.description, category_id: attrs.category_id)
    else
      {:error, :not_owner}
    end
  end

  def delete(id, user_id, role) do
    if Elixirideaboard.RoleHelpers.is_admin?(%{role: role}) || owner?(id, user_id) do
      delete_idea(id: id)
      {:ok, :deleted}
    else
      {:error, :not_authorized}
    end
  end

  def update_status(id, status, user_id, role) do
    if Elixirideaboard.RoleHelpers.is_admin?(%{role: role}) do
      update_idea_status(id: id, status: status)
    else
      {:error, :not_authorized}
    end
  end

  def owner?(id, user_id) do
    case check_owner(id: id) do
      {:ok, [%{user_id: uid}]} -> uid == user_id
      _ -> false
    end
  end

  def check_duplicate(user_id, title) do
    case check_duplicate_idea(user_id: user_id, title: title) do
      {:ok, [%{idea_id: id}]} -> {:ok, id}
      _ -> {:ok, nil}
    end
  end
end
