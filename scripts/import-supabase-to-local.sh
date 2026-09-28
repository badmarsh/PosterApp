#!/usr/bin/env bash
# =============================================================================
# import-supabase-to-local.sh
# Imports the Supabase PostgreSQL export into the local posterapp-postgres Docker
# container so agents can run tests against real production-like data.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SCHEMA_FILE="$PROJECT_DIR/supabase-schema.sql"
DATA_FILE="$PROJECT_DIR/supabase-data.sql"
CONTAINER="posterapp-postgres"
DB_NAME="posterapp"
DB_USER="postgres"

echo "=== PosterApp: Supabase → Local DB Import ==="

# 1. Check docker is running
if ! docker info &>/dev/null; then
  echo "ERROR: Docker is not running. Start Docker Desktop first."
  exit 1
fi

# 2. Start container if not running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Starting ${CONTAINER}..."
  docker start "$CONTAINER" || {
    echo "Container not found. Creating fresh pgvector container..."
    docker run -d \
      --name "$CONTAINER" \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB="$DB_NAME" \
      -p 5432:5432 \
      pgvector/pgvector:pg16
    sleep 5
  }
fi

# 3. Wait for postgres to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$DB_USER" &>/dev/null; then
    echo "PostgreSQL is ready."
    break
  fi
  sleep 1
done

# 4. Drop & recreate the database
echo "Recreating database '$DB_NAME'..."
docker exec "$CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
docker exec "$CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" postgres

# 5. Enable pgvector extension
echo "Enabling pgvector extension..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 6. Import schema
echo "Importing schema (252K)..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  --set ON_ERROR_STOP=off \
  < "$SCHEMA_FILE" 2>&1 | grep -v "^$" | grep -v "already exists" || true
echo "Schema imported."

# 7. Import data (3MB — no vectors, no logs)
echo "Importing data (3MB, excludes DocumentChunk/vectors)..."
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  --set ON_ERROR_STOP=off \
  < "$DATA_FILE" 2>&1 | grep -v "^$" || true
echo "Data imported."

# 8. Verify
echo ""
echo "=== Row counts after import ==="
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY n_live_tup DESC;"

echo ""
echo "=== DONE ==="
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/posterapp"
