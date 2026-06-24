defmodule IdeaBoard.ReactionsService do
  def toggle(user, idea_id, reaction_type) do
    {:ok, existing} = IdeaBoard.Repo.query(
      "SELECT * FROM idea_reactions WHERE user_id = ? AND idea_id = ?",
      [user.user_id, idea_id]
    )

    case existing.rows do
      [] ->
        IdeaBoard.Repo.query(
          "INSERT INTO idea_reactions (user_id, idea_id, reaction_type) VALUES (?, ?, ?)",
          [user.user_id, idea_id, reaction_type]
        )

      [[_, _, _, existing_type | _]] ->
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
    end

    IdeaBoard.IdeasStatsService.get_stats(idea_id)
  end
end
