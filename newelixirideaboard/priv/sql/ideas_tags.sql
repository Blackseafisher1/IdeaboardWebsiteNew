-- name: list-tags
SELECT t.name AS tag_name
FROM idea_tags it
JOIN tags t ON t.tag_id = it.tag_id
WHERE it.idea_id = :idea_id;
