-- name: list_projects
SELECT p.*, u.username AS owner_username
FROM projects p
JOIN users u ON u.user_id = p.owner_id
ORDER BY p.created_at DESC;

-- name: get_project
SELECT p.*, u.username AS owner_username
FROM projects p
JOIN users u ON u.user_id = p.owner_id
WHERE p.project_id = :id;

-- name: create_project
INSERT INTO projects (name, description, status, owner_id, created_at, updated_at)
VALUES (:name, :description, :status, :owner_id, NOW(), NOW());

-- name: update_project
UPDATE projects
SET name = :name, description = :description, status = :status, updated_at = NOW()
WHERE project_id = :id;

-- name: is_team_member_query
SELECT 1 AS ok FROM project_team WHERE project_id = :project_id AND user_id = :user_id;

-- name: get_team_members
SELECT u.*, pt.role FROM project_team pt
JOIN users u ON u.user_id = pt.user_id
WHERE pt.project_id = :project_id;
