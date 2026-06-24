defmodule Elixirideaboard.ProjectService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/projects.sql")

  def list do
    case list_projects(%{}) do
      {:ok, projects} -> projects
      _ -> []
    end
  end

  def get(id) do
    case get_project(id: id) do
      {:ok, [project]} -> project
      _ -> nil
    end
  end

  def create(attrs) do
    case create_project(
      name: attrs.name,
      description: attrs.description || "",
      status: attrs.status || "active",
      owner_id: attrs.owner_id
    ) do
      {:ok, %{last_insert_id: id}} -> {:ok, id}
      error -> error
    end
  end

  def is_team_member(project_id, user_id) do
    case is_team_member_query(project_id: project_id, user_id: user_id) do
      {:ok, [_]} -> true
      _ -> false
    end
  end
end
