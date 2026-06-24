-- Migration 0038: Seed default categories
INSERT IGNORE INTO categories (name) VALUES
  ('Innovation'),
  ('Prozess'),
  ('Produkt'),
  ('Kultur');
