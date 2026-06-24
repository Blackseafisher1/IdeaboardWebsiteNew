-- Migration: 0015_ideas_search_delete_trigger.sql
-- Ensure immediate removal of ideas_search rows when an idea is deleted

DROP TRIGGER IF EXISTS ideas_after_delete;
CREATE TRIGGER ideas_after_delete
AFTER DELETE ON ideas
FOR EACH ROW
  DELETE FROM ideas_search WHERE idea_id = OLD.idea_id;

