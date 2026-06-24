-- name: list-conversations
SELECT c.*,
  u1.username AS user1_username,
  u2.username AS user2_username
FROM conversations c
JOIN users u1 ON u1.user_id = c.user_id_1
JOIN users u2 ON u2.user_id = c.user_id_2
WHERE c.user_id_1 = :user_id OR c.user_id_2 = :user_id
ORDER BY c.last_message_at DESC;

-- name: get-or-create-conv
SELECT * FROM conversations
WHERE (user_id_1 = :user_id_1 AND user_id_2 = :user_id_2)
   OR (user_id_1 = :user_id_2 AND user_id_2 = :user_id_1)
LIMIT 1;

-- name: create-conversation
INSERT INTO conversations (user_id_1, user_id_2, created_at, last_message_at) VALUES (:user_id_1, :user_id_2, NOW(), NOW());

-- name: get-messages
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.conversation_id = :conversation_id
ORDER BY m.created_at DESC
LIMIT :limit;

-- name: get-messages-before
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.conversation_id = :conversation_id AND m.message_id < :before_id
ORDER BY m.created_at DESC
LIMIT :limit;

-- name: create-message
INSERT INTO dm_messages (conversation_id, sender_id, text, created_at) VALUES (:conversation_id, :sender_id, :text, NOW());

-- name: latest-message
SELECT m.*, u.username AS sender_username
FROM dm_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.conversation_id = :conversation_id
ORDER BY m.created_at DESC
LIMIT 1;

-- name: get-dm-file
SELECT * FROM dm_files WHERE conversation_id = :conversation_id AND filename = :filename;
