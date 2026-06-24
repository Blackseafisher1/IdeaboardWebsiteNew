defmodule IdeaBoard.PointsService do
  @point_values %{
    idea_created: 5,
    idea_with_tags: 2,
    idea_with_file: 3,
    user_registration: 10
  }

  def award_idea_created(user_id, idea_id, _conn \\ nil) do
    IdeaBoard.Repo.query(
      "INSERT INTO user_points_log (user_id, points, reason, reference_id, created_at) VALUES (?, ?, 'idea_created', ?, NOW())",
      [user_id, @point_values.idea_created, idea_id]
    )
  end

  def revert_idea_created(user_id, idea_id) do
    IdeaBoard.Repo.query(
      "INSERT INTO user_points_log (user_id, points, reason, reference_id, created_at) VALUES (?, ?, 'idea_deleted', ?, NOW())",
      [user_id, -@point_values.idea_created, idea_id]
    )
  end

  def add_pending_delta(opts) do
    IdeaBoard.Repo.query(
      "UPDATE user_points SET pending_delta = pending_delta + ? WHERE user_id = ?",
      [opts.delta, opts.userId]
    )
  end
end
