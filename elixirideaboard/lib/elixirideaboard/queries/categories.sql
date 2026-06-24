-- name: list_categories
SELECT * FROM categories ORDER BY name ASC;

-- name: get_category
SELECT * FROM categories WHERE category_id = :id;

-- name: create_category
INSERT INTO categories (name, description, color) VALUES (:name, :description, :color);

-- name: update_category
UPDATE categories SET name = :name, description = :description, color = :color WHERE category_id = :id;

-- name: delete_category
DELETE FROM categories WHERE category_id = :id;
