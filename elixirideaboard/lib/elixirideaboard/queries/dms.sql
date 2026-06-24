-- name: get_conversations
SELECT c.*, u.username AS partner_username, u.user_id AS partner_id,
  (SELECT content FROM dm_messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) AS last_message,
  (SELECT created_at FROM dm_messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) AS last_message_at
FROM dm_conversations c
JOIN dm_participants p1 ON p1.conversation_id = c.conversation_id AND p1.user_id = :user_id
JOIN dm_participants p2 ON p2.conversation_id = c.conversation_id AND p2.user_id != :user_id
JOIN users u ON u.user_id = p2.user_id
ORDER BY last_message_at DESC;

-- name: get_or_create_conversation
SELECT c.conversation_id
FROM dm_conversations c
JOIN dm_participants p1 ON p1.conversation_id = c.conversation_id AND p1.user_id = :user1
JOIN dm_participants p2 ON p2.conversation_id = c.conversation_id AND p2.user_id = :user2
LIMIT 1;

-- name: create_conversation
INSERT INTO dm_conversations (created_at) VALUES (NOW());

-- name: add_participant
INSERT INTO dm_participants (conversation_id, user_id) VALUES (:conversation_id, :user_id);

-- name: get_messages
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.conversation_id = :conversation_id
ORDER BY m.message_id DESC
LIMIT :limit;

-- name: get_messages_before
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.conversation_id = :conversation_id AND m.message_id < :before_id
ORDER BY m.message_id DESC
LIMIT :limit;

-- name: get_new_messages
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.conversation_id = :conversation_id AND m.message_id > :after_id
ORDER BY m.message_id ASC;

-- name: send_message
INSERT INTO dm_messages (conversation_id, sender_id, content, created_at, updated_at)
VALUES (:conversation_id, :sender_id, :content, NOW(), NOW());

-- name: update_message
UPDATE dm_messages SET content = :content, updated_at = NOW()
WHERE message_id = :message_id AND sender_id = :user_id;

-- name: delete_message_query
UPDATE dm_messages SET deleted_at = NOW(), content = '[gelöscht]'
WHERE message_id = :message_id AND sender_id = :user_id;

-- name: get_message_by_id
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.message_id = :message_id;

-- name: mark_read
UPDATE dm_read_receipts
SET read_at = NOW()
WHERE conversation_id = :conversation_id AND user_id = :user_id;
