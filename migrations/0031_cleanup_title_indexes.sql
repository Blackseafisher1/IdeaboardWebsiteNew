-- Migration: 0031_cleanup_title_indexes.sql


ALTER TABLE ideas_search DROP INDEX IF EXISTS idx_ideas_title;
ALTER TABLE ideas_search DROP INDEX IF EXISTS idx_ideas_search_title;

-- Drop any BTREE tags index (we need FULLTEXT for tags searches)
ALTER TABLE ideas_search DROP INDEX IF EXISTS idx_ideas_tags;


ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ft_author (author);
ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ft_tags (tags);

-- Ensure description-only FULLTEXT index exists
ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ideas_description (description);


