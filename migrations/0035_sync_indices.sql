-- Migration 0035: Sync Indices
-- Efficient delta sync using updated_at

CREATE INDEX IF NOT EXISTS idx_dm_messages_sync ON dm_messages (conversation_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_sync ON group_messages (group_id, updated_at);
