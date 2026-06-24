-- name: list_idea_tags
SELECT t.* FROM idea_tags t
JOIN idea_tag_links l ON l.tag_id = t.tag_id
WHERE l.idea_id = :idea_id
ORDER BY t.name;

-- name: find_tag_by_name
SELECT * FROM idea_tags WHERE name = :name;

-- name: create_tag
INSERT INTO idea_tags (name, created_at) VALUES (:name, NOW());

-- name: link_tag_to_idea
INSERT IGNORE INTO idea_tag_links (idea_id, tag_id) VALUES (:idea_id, :tag_id);

-- name: unlink_tag_from_idea
DELETE FROM idea_tag_links
WHERE idea_id = :idea_id AND tag_id = :tag_id;

-- name: delete_unused_tags
DELETE FROM idea_tags WHERE tag_id NOT IN (SELECT DISTINCT tag_id FROM idea_tag_links);
