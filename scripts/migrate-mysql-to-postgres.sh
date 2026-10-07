#!/bin/sh

set -eu

compose_path="${SOAP_EHR_COMPOSE_FILE:-compose.yml}"
legacy_app_container="${LEGACY_APP_CONTAINER:-fhir-soap-record}"
legacy_db_container="${LEGACY_DB_CONTAINER:-fhir-soap-record-db}"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="${MIGRATION_BACKUP_DIR:-backups/mysql-to-postgres-${timestamp}}"
v1_backup="${backup_dir}/fhir-soap-record-v1-mysql.sql"
v2_backup="${backup_dir}/soap-ehr-v2-postgresql.sql"
cutover_completed=0

on_exit() {
  if [ "$cutover_completed" -ne 1 ]; then
    echo "Cutover was not confirmed. The MySQL data was not deleted; inspect the application logs before retrying." >&2
  fi
}
trap on_exit EXIT HUP INT TERM

stop_required_container() {
  container="$1"
  running=$(docker container inspect --format '{{.State.Running}}' "$container" 2>/dev/null) || {
    echo "Required legacy container is missing: $container" >&2
    exit 1
  }
  if [ "$running" = "true" ]; then
    echo "Stopping legacy container $container"
    docker stop "$container" >/dev/null
  fi
}

echo "[1/7] Stopping application writes"
docker compose -f "$compose_path" stop soap-ehr >/dev/null 2>&1 || true
docker compose -f "$compose_path" stop soap-ehr-db >/dev/null 2>&1 || true
stop_required_container "$legacy_app_container"
stop_required_container "$legacy_db_container"

echo "[2/7] Starting renamed MySQL legacy service"
docker compose -f "$compose_path" up -d \
  soap-ehr-db-legacy \
  soap-ehr-db-legacy-init

echo "[3/7] Creating verified MySQL safety backup"
SOAP_EHR_COMPOSE_FILE="$compose_path" \
  sh scripts/backup-v1-mysql.sh "$v1_backup"

echo "[4/7] Starting PostgreSQL with canonical and OMOP schemas"
docker compose -f "$compose_path" up -d \
  soap-ehr-db \
  soap-ehr-omop-init

echo "[5/7] Converting and verifying MySQL V1 into PostgreSQL V2"
docker compose -f "$compose_path" --profile migration run --rm --build \
  soap-ehr-migration pnpm prisma:migrate:deploy
docker compose -f "$compose_path" --profile migration run --rm \
  soap-ehr-migration pnpm migrate:v1-to-v2 run

echo "[6/7] Building and verifying the OMOP projection"
docker compose -f "$compose_path" --profile migration run --rm \
  soap-ehr-migration pnpm omop:etl run
SOAP_EHR_COMPOSE_FILE="$compose_path" \
  sh scripts/backup-v2-postgres.sh "$v2_backup"

echo "[7/7] Starting soap-ehr against PostgreSQL"
docker compose -f "$compose_path" up -d --build soap-ehr

attempt=0
until docker compose -f "$compose_path" exec -T soap-ehr \
  wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 120 ]; then
    echo "Application did not become ready. MySQL remains available as soap-ehr-db-legacy." >&2
    exit 1
  fi
  sleep 2
done

cutover_completed=1
trap - EXIT HUP INT TERM

echo "Cutover completed successfully."
echo "MySQL safety backup: $v1_backup"
echo "PostgreSQL recovery dump: $v2_backup"
echo "The application now uses soap-ehr-db (PostgreSQL)."
echo "soap-ehr-db-legacy was preserved and can be removed after your acceptance check."
