-- name: list_groups
SELECT * FROM `groups` ORDER BY created_at DESC;

-- name: get_group
SELECT * FROM `groups` WHERE group_id = :id;

-- name: create_group
INSERT INTO `groups` (name, owner_user_id, is_private, created_at)
VALUES (:name, :owner_user_id, :is_private, NOW());

-- name: is_member
SELECT 1 AS ok FROM group_members WHERE group_id = :group_id AND user_id = :user_id;

-- name: get_members
SELECT u.*, gm.role FROM group_members gm
JOIN users u ON u.user_id = gm.user_id
WHERE gm.group_id = :group_id;

-- name: add_member
INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (:group_id, :user_id, :role);

-- name: remove_member_query
DELETE FROM group_members WHERE group_id = :group_id AND user_id = :user_id;

-- name: get_member_role
SELECT role FROM group_members WHERE group_id = :group_id AND user_id = :user_id;

-- name: get_group_messages
SELECT m.*, u.username AS sender_username
FROM group_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.group_id = :group_id AND m.message_id > :after_id
ORDER BY m.message_id ASC;

-- name: get_group_messages_latest
SELECT m.*, u.username AS sender_username
FROM group_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.group_id = :group_id
ORDER BY m.message_id DESC
LIMIT :limit;

-- name: get_group_messages_before
SELECT m.*, u.username AS sender_username
FROM group_messages m
JOIN users u ON u.user_id = m.sender_id
WHERE m.group_id = :group_id AND m.message_id < :before_id
ORDER BY m.message_id DESC
LIMIT :limit;

-- name: send_group_message
INSERT INTO group_messages (group_id, sender_id, content, created_at, updated_at)
VALUES (:group_id, :sender_id, :content, NOW(), NOW());
