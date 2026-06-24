-- name: get_idea_likes
SELECT COUNT(*) AS count FROM idea_reactions WHERE idea_id = :idea_id AND reaction_type = 'like';

-- name: get_idea_dislikes
SELECT COUNT(*) AS count FROM idea_reactions WHERE idea_id = :idea_id AND reaction_type = 'dislike';

-- name: user_reaction
SELECT reaction_type FROM idea_reactions WHERE idea_id = :idea_id AND user_id = :user_id;

-- name: toggle_like_reaction
INSERT INTO idea_reactions (idea_id, user_id, reaction_type, created_at)
VALUES (:idea_id, :user_id, 'like', NOW())
ON DUPLICATE KEY UPDATE reaction_type = CASE WHEN reaction_type = 'like' THEN 'none' ELSE 'like' END;

-- name: toggle_dislike_reaction
INSERT INTO idea_reactions (idea_id, user_id, reaction_type, created_at)
VALUES (:idea_id, :user_id, 'dislike', NOW())
ON DUPLICATE KEY UPDATE reaction_type = CASE WHEN reaction_type = 'dislike' THEN 'none' ELSE 'dislike' END;
