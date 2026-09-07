#!/bin/sh

set -eu

output_path="${1:-docs/migration/v1/fixtures/v1-backup.sql}"
compose_path="${SOAP_EHR_COMPOSE_FILE:-compose.dev.yml}"
service="soap-ehr-db-legacy"
output_dir=$(dirname "$output_path")
temporary_path="${output_path}.tmp"

mkdir -p "$output_dir"
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM

docker compose -f "$compose_path" exec -T "$service" sh -eu -c '
  exec mysqldump \
    --user="$MYSQL_USER" \
    --password="$MYSQL_PASSWORD" \
    --host=127.0.0.1 \
    --single-transaction \
    --quick \
    --hex-blob \
    --routines \
    --triggers \
    --events \
    --skip-dump-date \
    --set-gtid-purged=OFF \
    --no-tablespaces \
    --default-character-set=utf8mb4 \
    --add-drop-table \
    "$MYSQL_DATABASE"
' > "$temporary_path"

test -s "$temporary_path"
grep -q 'MySQL dump' "$temporary_path"
mv "$temporary_path" "$output_path"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$output_path" > "${output_path}.sha256"
else
  sha256sum "$output_path" > "${output_path}.sha256"
fi
trap - EXIT HUP INT TERM

echo "V1 MySQL backup written to $output_path"
echo "SHA-256 written to ${output_path}.sha256"
