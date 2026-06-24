-- Migration: 0034_add_title_fulltext.sql

-- Ensure FULLTEXT index on title exists for MATCH(s.title) searches
ALTER TABLE ideas_search ADD FULLTEXT IF NOT EXISTS idx_ideas_title (title);

-- Ensure there is an index on users.username to support prefix author lookups
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_username_btree (username);
