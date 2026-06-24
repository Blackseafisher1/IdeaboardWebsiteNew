-- Migration 0039: Levenshtein UDF registrieren
-- Erfordert: libdamlev.so im Plugin-Verzeichnis (siehe Levenshtein/README.md)

CREATE FUNCTION IF NOT EXISTS edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS bounded_edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS bounded_edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS min_edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS min_edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS similarity_t RETURNS REAL SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS min_similarity_t RETURNS REAL SONAME 'libdamlev.so';
