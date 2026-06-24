CREATE TABLE IF NOT EXISTS user_points (
  user_id INT PRIMARY KEY,
  current_points INT DEFAULT 0,
  pending_delta INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

