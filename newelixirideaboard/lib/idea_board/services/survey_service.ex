defmodule IdeaBoard.SurveyService do
  def list(_user) do
    {:ok, result} = IdeaBoard.Repo.query("SELECT s.*, u.username AS author_username FROM surveys s JOIN users u ON u.user_id = s.user_id ORDER BY s.created_at DESC")
    result.rows || []
  end
end
