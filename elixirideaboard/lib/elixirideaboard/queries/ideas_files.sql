-- name: list_idea_files
SELECT * FROM idea_files WHERE idea_id = :idea_id;

-- name: get_idea_file
SELECT * FROM idea_files WHERE file_id = :file_id;

-- name: create_idea_file
INSERT INTO idea_files (idea_id, user_id, file_path, original_name, file_size, mime_type, created_at)
VALUES (:idea_id, :user_id, :file_path, :original_name, :file_size, :mime_type, NOW());

-- name: delete_idea_file
DELETE FROM idea_files WHERE file_id = :file_id;

-- name: check_idea_file_owner
SELECT user_id FROM idea_files WHERE file_id = :file_id;
