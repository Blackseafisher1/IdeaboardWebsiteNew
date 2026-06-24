

CREATE EVENT IF NOT EXISTS ideas_search_upsert
ON SCHEDULE EVERY 2 SECOND
DO
INSERT INTO ideas_search (
  idea_id, user_id, category_id, title, description, author, created_at, updated_at,
  like_count, dislike_count, comment_count, tags
)
SELECT
  i.idea_id,
  i.user_id,
  i.category_id,
  i.title,
  i.description,
  COALESCE(u.username, ''),
  i.created_at,
  i.updated_at,
  i.like_count,
  i.dislike_count,
  i.comment_count,
  (SELECT GROUP_CONCAT(t.name SEPARATOR ' ') FROM idea_tag_links l JOIN idea_tags t ON t.tag_id = l.tag_id WHERE l.idea_id = i.idea_id GROUP BY l.idea_id) AS tags
FROM ideas i
LEFT JOIN users u ON i.user_id = u.user_id
LEFT JOIN ideas_search s ON s.idea_id = i.idea_id
WHERE s.idea_id IS NULL OR i.updated_at > s.updated_at
LIMIT 100000
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  category_id = VALUES(category_id),
  title = VALUES(title),
  description = VALUES(description),
  author = VALUES(author),
  created_at = VALUES(created_at),
  updated_at = VALUES(updated_at),
  like_count = VALUES(like_count),
  dislike_count = VALUES(dislike_count),
  comment_count = VALUES(comment_count),
  tags = VALUES(tags);

