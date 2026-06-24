-- name: get-reaction
SELECT * FROM idea_reactions WHERE user_id = :user_id AND idea_id = :idea_id;

-- name: create-reaction
INSERT INTO idea_reactions (user_id, idea_id, reaction_type) VALUES (:user_id, :idea_id, :reaction_type);

-- name: delete-reaction
DELETE FROM idea_reactions WHERE user_id = :user_id AND idea_id = :idea_id;

-- name: update-reaction
UPDATE idea_reactions SET reaction_type = :reaction_type WHERE user_id = :user_id AND idea_id = :idea_id;
