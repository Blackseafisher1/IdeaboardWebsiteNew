defmodule IdeaBoard.RepoRunner do
  use AyeSQL.Runner

  alias AyeSQL.Query
  alias AyeSQL.Runner

  @impl true
  def run(%Query{statement: stmt, arguments: args}, options) do
    mysql_stmt = String.replace(stmt, ~r/\$\d+/, "?")
    with {:ok, result} <- IdeaBoard.Repo.query(mysql_stmt, args) do
      result = Runner.handle_result(result, options)
      {:ok, result}
    end
  end
end
