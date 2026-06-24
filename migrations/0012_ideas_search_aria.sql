
CREATE TABLE IF NOT EXISTS ideas_search (
  idea_id INT PRIMARY KEY,
  user_id INT,
  category_id INT,
  title VARCHAR(70),
  description TEXT,
  author VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  like_count INT NOT NULL DEFAULT 0,
  dislike_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0
  ,tags VARCHAR(255)
) ENGINE=InnoDB;





-- Mirror important indexes used for ordering and filtering on the primary ideas table
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_created_at (created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_category_created (category_id, created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_cat_like_created (category_id, like_count, created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_cat_comment_created (category_id, comment_count, created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_cat_dislike_created (category_id, dislike_count, created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_created_at_id (created_at, idea_id);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_comment_count_created_at (comment_count, created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_like_count_created_at (like_count, created_at);
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_dislike_count_created_at (dislike_count, created_at);


-- Helps when users filter by category AND search by author
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_author_category (author, category_id);


ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_category_id (category_id);

ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ideas_description (description);

ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ideas_title (title);

ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_author (author(100));

-- Fulltext for tags (tag names concatenated per idea)
ALTER TABLE ideas_search ADD INDEX IF NOT EXISTS idx_ideas_tags (tags(191));




-- Populate (replace existing contents)
TRUNCATE TABLE ideas_search;
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
LEFT JOIN users u ON i.user_id = u.user_id;
