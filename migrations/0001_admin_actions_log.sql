-- Adds audit logging table for admin actions (for existing databases)

CREATE TABLE IF NOT EXISTS admin_actions_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NOT NULL,
    target_user_id INT,
    action VARCHAR(128) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;
