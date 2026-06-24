defmodule IdeaBoard.ProjectService do
  def list(_user) do
    try do
      case IdeaBoard.Repo.query_maps(
             "SELECT p.*, u.username AS author_username FROM projects p JOIN users u ON u.user_id = p.user_id ORDER BY p.created_at DESC"
           ) do
        {:ok, maps} -> maps
        _ -> []
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end
end
