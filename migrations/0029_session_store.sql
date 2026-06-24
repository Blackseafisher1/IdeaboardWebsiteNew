-- migrations/0029_session_store.sql
-- Create sessions table for persistent express-session storage using MariaDB

CREATE TABLE IF NOT EXISTS `sessions` (
  `sid` VARCHAR(128) NOT NULL PRIMARY KEY,
  `sess` JSON NOT NULL,
  `expires` DATETIME NOT NULL,
  INDEX `idx_sessions_expires` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
