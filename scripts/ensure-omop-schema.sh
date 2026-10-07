#!/bin/sh

set -eu

: "${OMOP_DB_HOST:?OMOP_DB_HOST is required}"
: "${OMOP_DB_NAME:?OMOP_DB_NAME is required}"
: "${OMOP_DB_USER:?OMOP_DB_USER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

schema_exists="$({
  psql \
    --host "$OMOP_DB_HOST" \
    --username "$OMOP_DB_USER" \
    --dbname "$OMOP_DB_NAME" \
    --tuples-only \
    --no-align \
    --command "SELECT to_regclass('soap_ehr_etl.schema_version') IS NOT NULL;"
} | tr -d '[:space:]')"

if [ "$schema_exists" != "t" ]; then
  {
    echo "BEGIN;"
    echo "CREATE SCHEMA IF NOT EXISTS omop;"
    sed 's/@cdmDatabaseSchema/omop/g' /omop/official/OMOPCDM_postgresql_5.4_ddl.sql
    sed 's/@cdmDatabaseSchema/omop/g' /omop/official/OMOPCDM_postgresql_5.4_primary_keys.sql
    cat /omop/bootstrap-vocabulary.sql
    sed 's/@cdmDatabaseSchema/omop/g' /omop/official/OMOPCDM_postgresql_5.4_constraints.sql
    sed 's/@cdmDatabaseSchema/omop/g' /omop/official/OMOPCDM_postgresql_5.4_indices.sql
    cat /omop/soap-ehr-etl.sql
    echo "COMMIT;"
  } | psql \
    --host "$OMOP_DB_HOST" \
    --username "$OMOP_DB_USER" \
    --dbname "$OMOP_DB_NAME" \
    --set ON_ERROR_STOP=1
else
  psql \
    --host "$OMOP_DB_HOST" \
    --username "$OMOP_DB_USER" \
    --dbname "$OMOP_DB_NAME" \
    --set ON_ERROR_STOP=1 \
    --file /omop/bootstrap-vocabulary.sql
  psql \
    --host "$OMOP_DB_HOST" \
    --username "$OMOP_DB_USER" \
    --dbname "$OMOP_DB_NAME" \
    --set ON_ERROR_STOP=1 \
    --file /omop/soap-ehr-etl.sql
fi
