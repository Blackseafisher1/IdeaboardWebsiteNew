#!/usr/bin/env bash
set -euo pipefail

# db_migrate_helper.sh
# - loads .env (if present)
# - prints masked DB vars
# - shows grants for the app user
# - lists migrations and runs migrate.js

cd "$(dirname "$0")/.." || exit 1

if [ -f .env ]; then
  echo "Loading .env"
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

: "DB variables"
DB_HOST=${DB_HOST:-127.0.0.1}
DB_USER=${DB_USER:-ideaboard}
DB_PASSWORD_SET=no
if [ -n "${DB_PASSWORD-}" ]; then DB_PASSWORD_SET=yes; fi

echo "DB_HOST=${DB_HOST} DB_USER=${DB_USER} DB_PASSWORD_set=${DB_PASSWORD_SET}"

echo "\n== migrations folder =="
ls -la migrations || true

echo "\n== Checking grants for user ${DB_USER} =="
mariadb -e "SHOW GRANTS FOR '${DB_USER}'@'localhost'; SHOW GRANTS FOR '${DB_USER}'@'127.0.0.1'; SELECT User,Host FROM mysql.user WHERE User='${DB_USER}';" || true

echo "\n== Running migration (node migrate.js) =="
DB_HOST=${DB_HOST} DB_USER=${DB_USER} DB_PASSWORD="${DB_PASSWORD-}" node --max-old-space-size=8192 migrate.js

echo "\nDone."
