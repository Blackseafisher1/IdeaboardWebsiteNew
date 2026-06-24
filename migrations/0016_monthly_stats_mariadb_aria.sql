-- Migration: 0016_monthly_stats_mariadb_aria.sql


-- 1. ARIA-Tabelle für Stats
CREATE TABLE IF NOT EXISTS monthly_stats (
  month VARCHAR(7) PRIMARY KEY,        -- YYYY-MM
  idea_count INT NOT NULL DEFAULT 0,
  active_users INT NOT NULL DEFAULT 0, -- Updated via Event
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=ARIA ROW_FORMAT=PAGE TRANSACTIONAL=0 CHECKSUM=1;

-- 2. Initiale Daten (nur aktuelle Monate)
INSERT IGNORE INTO monthly_stats (month, idea_count, active_users)
SELECT 
  DATE_FORMAT(i.created_at, '%Y-%m') as month,
  COUNT(*) as idea_count,
  COUNT(DISTINCT i.user_id) as active_users
FROM ideas i 
WHERE i.created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 12 MONTH), '%Y-%m')
GROUP BY DATE_FORMAT(i.created_at, '%Y-%m');

-- 3. OPTIMIZED MariaDB Triggers (schnell & zuverlässig)
DELIMITER $$

-- CREATE: Zähle hoch
CREATE TRIGGER IF NOT EXISTS monthly_stats_insert 
AFTER INSERT ON ideas
FOR EACH ROW
BEGIN
  INSERT INTO monthly_stats (month, idea_count) 
  VALUES (DATE_FORMAT(NEW.created_at, '%Y-%m'), 1)
  ON DUPLICATE KEY UPDATE 
    idea_count = idea_count + 1,
    updated_at = CURRENT_TIMESTAMP;
END$$

-- DELETE: Zähle runter (nie unter 0)
CREATE TRIGGER IF NOT EXISTS monthly_stats_delete 
AFTER DELETE ON ideas
FOR EACH ROW
BEGIN
  UPDATE monthly_stats 
  SET 
    idea_count = CASE WHEN idea_count > 0 THEN idea_count - 1 ELSE 0 END,
    updated_at = CURRENT_TIMESTAMP
  WHERE month = DATE_FORMAT(OLD.created_at, '%Y-%m');
END$$

-- UPDATE: Falls created_at geändert wird (selten)
CREATE TRIGGER IF NOT EXISTS monthly_stats_update 
AFTER UPDATE ON ideas
FOR EACH ROW
BEGIN
  IF OLD.created_at != NEW.created_at THEN
    -- Alte Monat abziehen
    UPDATE monthly_stats 
    SET idea_count = CASE WHEN idea_count > 0 THEN idea_count - 1 ELSE 0 END
    WHERE month = DATE_FORMAT(OLD.created_at, '%Y-%m');
    
    -- Neue Monat addieren
    INSERT INTO monthly_stats (month, idea_count) 
    VALUES (DATE_FORMAT(NEW.created_at, '%Y-%m'), 1)
    ON DUPLICATE KEY UPDATE idea_count = idea_count + 1,
    updated_at = CURRENT_TIMESTAMP;
  END IF;
END$$

DELIMITER ;

-- 4. Maintenance Event: Recalculate `active_users` for current + previous month
CREATE EVENT IF NOT EXISTS sync_active_users_stats
ON SCHEDULE EVERY 1 MINUTE
DO
  UPDATE monthly_stats s
  SET s.active_users = (
    SELECT COUNT(DISTINCT user_id)
    FROM ideas
    WHERE DATE_FORMAT(created_at, '%Y-%m') = s.month
  )
  WHERE s.month >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m');

-- 4. Performance Index 
ALTER TABLE monthly_stats ADD INDEX IF NOT EXISTS idx_month (month);

-- 5. Cleanup: Alte Daten >12 Monate 
DELETE FROM monthly_stats WHERE month < DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 13 MONTH), '%Y-%m');
