# Levenshtein UDF Test Results

Alle Funktionen registriert und getestet.

## Funktioniert

| Funktion | Ergebnis |
|----------|----------|
| `edit_dist('Hallo', 'Hallo')` | `0` |
| `edit_dist('Hallo', 'Hallo Welt')` | `5` |
| `edit_dist('Katze', 'Hund')` | `5` |
| `bounded_edit_dist('Hallo', 'Hallo Welt', 3)` | `4` (cutoff überschritten) |
| `bounded_edit_dist('Katze', 'Katze', 2)` | `0` |
| `edit_dist_t('abc', 'acb')` | `1` (Transposition) |
| `edit_dist('abc', 'acb')` | `2` (keine Transposition) |

## Bekanntes Problem

`similarity_t` / `min_similarity_t` erwartet REAL_RESULT für 3. Parameter,
aber MariaDB liefert DECIMAL_RESULT für numerische Literale.
Workaround: UDF-Source um DECIMAL_RESULT erweitern, dann neu bauen.

## Nächste Schritte

- UDF-Source fixen: `similarity_t.cpp` Zeile 68 um `|| args->arg_type[2] != DECIMAL_RESULT` erweitern  
- optional: Migration `0039_levenshtein_udf.sql` erstellen für Registrierung
- optional: Integration in `ideasSearchService.js` als wählbaren Fuzzy-Modus
