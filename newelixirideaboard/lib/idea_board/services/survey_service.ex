defmodule IdeaBoard.SurveyService do
  def list(_user) do
    try do
      case IdeaBoard.Repo.query_maps(
             "SELECT s.*, u.username AS author_username FROM surveys s JOIN users u ON u.user_id = s.user_id ORDER BY s.created_at DESC"
           ) do
        {:ok, maps} -> maps
        _ -> []
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> []
    end
  end
end
