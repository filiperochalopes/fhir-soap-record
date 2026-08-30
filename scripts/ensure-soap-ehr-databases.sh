#!/bin/sh

set -eu

for value in "${V1_DB_NAME}" "${SOAP_EHR_DB_NAME}" "${DB_USER}"; do
  case "${value}" in
    *[!A-Za-z0-9_]*|'')
      echo "Database and user names may contain only letters, numbers, and underscores." >&2
      exit 1
      ;;
  esac
done

mysql --host="${DB_HOST}" --user=root --execute="
  CREATE DATABASE IF NOT EXISTS \`${V1_DB_NAME}\`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE DATABASE IF NOT EXISTS \`${SOAP_EHR_DB_NAME}\`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`${V1_DB_NAME}\`.* TO '${DB_USER}'@'%';
  GRANT ALL PRIVILEGES ON \`${SOAP_EHR_DB_NAME}\`.* TO '${DB_USER}'@'%';
  FLUSH PRIVILEGES;
"
