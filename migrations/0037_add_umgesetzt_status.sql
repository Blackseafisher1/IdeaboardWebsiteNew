ALTER TABLE ideas
MODIFY COLUMN status ENUM('neu','in prüfung','akzeptiert','abgelehnt','umgesetzt') NOT NULL DEFAULT 'neu';
