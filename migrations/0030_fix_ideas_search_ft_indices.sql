-- Migration: 0030_fix_ideas_search_ft_indices.sql


-- 1. Add missing FULLTEXT index on author for MATCH(s.author) calls
ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ft_author (author);

-- 2. Convert tags index to FULLTEXT (was BTREE but used with MATCH)
ALTER TABLE ideas_search DROP INDEX IF EXISTS idx_ideas_tags;
ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ft_tags (tags);
