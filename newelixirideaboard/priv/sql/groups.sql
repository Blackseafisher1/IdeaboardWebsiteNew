-- name: list-user-groups
SELECT g.* FROM groups g
JOIN group_members gm ON gm.group_id = g.group_id
WHERE gm.user_id = :user_id
ORDER BY g.name ASC;

-- name: get-group-messages
SELECT gm.*, u.username AS sender_username
FROM group_messages gm
JOIN users u ON u.user_id = gm.sender_id
WHERE gm.group_id = :group_id
ORDER BY gm.created_at DESC
LIMIT :limit;

-- name: get-group-messages-before
SELECT gm.*, u.username AS sender_username
FROM group_messages gm
JOIN users u ON u.user_id = gm.sender_id
WHERE gm.group_id = :group_id AND gm.message_id < :before_id
ORDER BY gm.created_at DESC
LIMIT :limit;

-- name: create-group-message
INSERT INTO group_messages (group_id, sender_id, text, created_at) VALUES (:group_id, :sender_id, :text, NOW());

-- name: latest-group-message
SELECT gm.*, u.username AS sender_username
FROM group_messages gm
JOIN users u ON u.user_id = gm.sender_id
WHERE gm.group_id = :group_id
ORDER BY gm.created_at DESC
LIMIT 1;

-- name: get-group-file
SELECT * FROM group_files WHERE group_id = :group_id AND filename = :filename;
