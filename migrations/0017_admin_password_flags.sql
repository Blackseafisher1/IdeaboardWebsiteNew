
CREATE TABLE IF NOT EXISTS admin_password_flags (
  user_id INT NOT NULL PRIMARY KEY
);

DROP TRIGGER IF EXISTS trg_admin_password_flags_delete;
DELIMITER $$
CREATE TRIGGER trg_admin_password_flags_delete
AFTER DELETE ON users
FOR EACH ROW
BEGIN
  DELETE FROM admin_password_flags WHERE user_id = OLD.user_id;
END$$
DELIMITER ;