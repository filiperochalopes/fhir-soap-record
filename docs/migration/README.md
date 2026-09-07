# V1 to V2 migration runbook

The converter reads the old MySQL `fhir_soap_record` database and writes the
clean PostgreSQL `soap_ehr` database. The V2 application never reads V1 tables
at runtime.

## Safety contract

- Take and verify a production backup before a real cutover.
- Stop V1 writes during the final conversion window.
- Point `V1_DATABASE_URL` and `DATABASE_URL` at different databases.
- Start with an empty V2 database containing only the committed V2 migrations.
- Keep the V1 database stale after cutover; do not drop it as part of this script.

A raw MySQL dump is not PostgreSQL-compatible and would recreate the wrong V1
tables even after SQL-dialect conversion. The supported recovery path is:

```text
verified MySQL dump -> restored MySQL V1 -> semantic converter -> PostgreSQL V2
```

The cutover command retains a raw MySQL safety dump and creates a
PostgreSQL-native dump containing the canonical, OMOP and ETL schemas. Database
backups do not contain attachment objects; back up the configured S3-compatible
bucket separately.

The converter refuses a populated target unless it contains its own resumable
migration marker. Source timestamps are interpreted as UTC MySQL `DATETIME`
values so the conversion does not apply the workstation's timezone offset.

## One-command cutover

```bash
pnpm migrate:mysql-to-postgres
```

The command stops application writes, exposes the existing MySQL volume through
`soap-ehr-db-legacy`, creates both dumps, provisions PostgreSQL, converts and
verifies V2, refreshes OMOP, and starts the application. `soap-ehr-db` keeps the
address the application already uses; only its database engine changes.

Set `MIGRATION_BACKUP_DIR=/secure/path` to choose the output directory. The
default is a timestamped directory under ignored `backups/`. Use
`SOAP_EHR_COMPOSE_FILE=compose.dev.yml` only for the local development stack.

`run` is resumable and idempotent for the same source. It preserves relational
IDs and timestamps, converts SOAP and narrative notes into canonical composition
versions, records V1 provenance, reconnects attachments, and then performs the
same checks as `verify`. Explicit numeric IDs are preserved and PostgreSQL
sequences are realigned before the V2 runtime accepts new writes.

Verification compares row counts, attachment-to-composition links, a canonical
clinical-content SHA-256 digest, and full operational-row SHA-256 digests for
every copied table. Migration-only settings and new V2 clinical audit events are
excluded from the V1 equality digest because they have no V1 counterpart.

The deterministic, entirely synthetic V1 migrations and fixture are under
[`v1/`](v1/README.md).
