#!/bin/sh

set -eu

input_path="${1:-docs/migration/v1/fixtures/v1-backup.sql}"
compose_path="${SOAP_EHR_COMPOSE_FILE:-compose.dev.yml}"
service="soap-ehr-db-legacy"

if [ "${CONFIRM_RESTORE_V1:-}" != "1" ]; then
  echo "Refusing to overwrite the V1 database. Re-run with CONFIRM_RESTORE_V1=1." >&2
  exit 1
fi

test -s "$input_path"
if [ -f "${input_path}.sha256" ]; then
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "${input_path}.sha256"
  else
    sha256sum -c "${input_path}.sha256"
  fi
fi

docker compose -f "$compose_path" exec -T "$service" sh -eu -c '
  exec mysql \
    --user="$MYSQL_USER" \
    --password="$MYSQL_PASSWORD" \
    --host=127.0.0.1 \
    "$MYSQL_DATABASE"
' < "$input_path"

echo "V1 MySQL backup restored from $input_path"
