# Todo – Offene Punkte

## Seed-Script
- [ ] `seed-test-data.js` erzeugt Testnutzer mit unvollständigen DM-Referenzen → `Failed to fetch` bei Chat-Aktionen. Normale Registrierung funktioniert.

## Mögliche Verbesserungen
- Levenshtein UDF in `ideasSearchService.js` als optionaler Fuzzy-Fallback integrieren
- `buildBooleanQuery()` in `ideasSearchService.js` bereits gesichert ✓
- Lazy `require('./ideasFilesService')` in `ideasService.js:39` auflösen (zirkuläre Deps)
- Event Scheduler (`server.js:373`) sollte automatisch aktiviert werden, nicht nur Hinweis
- Migration `0039_fulltext_projects_surveys.sql` testen ob Indizes korrekt erstellt

## Erledigt
- Dead Code entfernt ✓
- Alle Inline-Kommentare deutsch ✓
- Fuse.js entfernt, FULLTEXT-Suche für Projekte/Umfragen ✓
- Levenshtein UDF gebaut + registriert ✓
- Projekt-/Umfragenseite: Filter + Suche bleiben nach HTMX-Poll erhalten ✓
- "Keine Ergebnisse"-Meldungen zeigen jetzt Suchbegriff ✓
