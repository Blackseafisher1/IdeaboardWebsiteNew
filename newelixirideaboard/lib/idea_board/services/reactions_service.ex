defmodule IdeaBoard.ReactionsService do
  def toggle(user, idea_id, reaction_type) do
    try do
      case IdeaBoard.Repo.query_map(
        "SELECT * FROM idea_reactions WHERE user_id = ? AND idea_id = ?",
        [user.user_id, idea_id]
      ) do
        {:ok, nil} ->
          IdeaBoard.Repo.query(
            "INSERT INTO idea_reactions (user_id, idea_id, reaction_type) VALUES (?, ?, ?)",
            [user.user_id, idea_id, reaction_type]
          )

        {:ok, %{"reaction_type" => existing_type}} ->
          if existing_type == reaction_type do
            IdeaBoard.Repo.query(
              "DELETE FROM idea_reactions WHERE user_id = ? AND idea_id = ?",
              [user.user_id, idea_id]
            )
          else
            IdeaBoard.Repo.query(
              "UPDATE idea_reactions SET reaction_type = ? WHERE user_id = ? AND idea_id = ?",
              [reaction_type, user.user_id, idea_id]
            )
          end

        _ -> :ok
      end

      IdeaBoard.IdeasStatsService.get_stats(idea_id)
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> {:ok, %{like_count: 0, dislike_count: 0, comment_count: 0}}
    end
  end
end
