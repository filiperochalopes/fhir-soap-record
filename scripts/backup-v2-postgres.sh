#!/bin/sh

set -eu

output_path="${1:-soap-ehr-v2-postgresql.sql}"
compose_path="${SOAP_EHR_COMPOSE_FILE:-compose.dev.yml}"
service="soap-ehr-db"
output_dir=$(dirname "$output_path")
temporary_path="${output_path}.tmp"

mkdir -p "$output_dir"
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM

docker compose -f "$compose_path" exec -T "$service" sh -eu -c '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  exec pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=plain \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges
' > "$temporary_path"

test -s "$temporary_path"
grep -q 'PostgreSQL database dump' "$temporary_path"
mv "$temporary_path" "$output_path"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$output_path" > "${output_path}.sha256"
else
  sha256sum "$output_path" > "${output_path}.sha256"
fi
trap - EXIT HUP INT TERM

echo "V2 PostgreSQL backup written to $output_path"
echo "SHA-256 written to ${output_path}.sha256"
