#!/usr/bin/env bash
#
# Convenience wrapper around the Postgres.app cluster that backs the Student
# Store API. It starts Postgres.app's own data directory (the one its GUI shows)
# and makes sure the `student_store` database + `postgres` login exist.
#
# Usage: ./scripts/db.sh {start|stop|status}
#
set -euo pipefail

PORT="${PGPORT:-5432}"
DB_NAME="${DB_NAME:-student_store}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"

# Postgres.app keeps its cluster here; the version folder may vary.
find_var() {
  for v in 18 17 16 15 14; do
    cand="$HOME/Library/Application Support/Postgres/var-$v"
    if [ -f "$cand/PG_VERSION" ]; then
      echo "$cand"
      return
    fi
  done
  echo ""
}

# Find Postgres binaries: prefer PATH, fall back to Postgres.app on macOS.
find_pgbin() {
  if command -v pg_ctl >/dev/null 2>&1; then
    dirname "$(command -v pg_ctl)"
    return
  fi
  for v in latest 18 17 16 15 14; do
    cand="/Applications/Postgres.app/Contents/Versions/$v/bin"
    if [ -x "$cand/pg_ctl" ]; then
      echo "$cand"
      return
    fi
  done
  echo ""
}

PGBIN="$(find_pgbin)"
PGVAR="$(find_var)"
if [ -z "$PGBIN" ] || [ -z "$PGVAR" ]; then
  echo "❌ Could not find Postgres.app binaries or its data directory." >&2
  echo "   Open Postgres.app once to initialize it, or install PostgreSQL." >&2
  exit 1
fi

case "${1:-}" in
  start)
    if "$PGBIN/pg_isready" -h localhost -p "$PORT" >/dev/null 2>&1; then
      echo "✅ Postgres already accepting connections on localhost:$PORT"
    else
      echo "▶️  Starting Postgres.app cluster ($PGVAR) on localhost:$PORT …"
      "$PGBIN/pg_ctl" -D "$PGVAR" -l "$PGVAR/postgres-server.log" start
      sleep 2
    fi
    # Ensure the login + database exist (idempotent).
    "$PGBIN/psql" -h localhost -p "$PORT" -d postgres \
      -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
    if ! "$PGBIN/psql" -h localhost -p "$PORT" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
      "$PGBIN/psql" -h localhost -p "$PORT" -d postgres \
        -c "CREATE DATABASE $DB_NAME;" >/dev/null
      echo "🗄️  Created database '$DB_NAME'"
    fi
    echo "✅ Ready: postgresql://$DB_USER:***@localhost:$PORT/$DB_NAME"
    echo "   (visible in the Postgres.app window as '$DB_NAME')"
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$PGVAR" stop || true
    ;;
  status)
    "$PGBIN/pg_isready" -h localhost -p "$PORT" || true
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
