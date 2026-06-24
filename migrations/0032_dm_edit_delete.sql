-- migrations/0032_dm_edit_delete.sql

ALTER TABLE dm_messages 
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Update existing messages to have a valid updated_at based on created_at
UPDATE dm_messages SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = '0000-00-00 00:00:00';
