-- name: create-file
INSERT INTO idea_files (idea_id, filename, original_name, mimetype) VALUES (:idea_id, :filename, :original_name, :mimetype);

-- name: get-idea-file
SELECT * FROM idea_files WHERE file_id = :file_id;
