# V1 synthetic migration fixture

This documentation directory is the only retained V1 artifact. It is not
imported or copied into the soap-ehr runtime image.

- `prisma/migrations/` rebuilds the final V1 schema.
- `fixtures/seed-v1.sql` adds deterministic synthetic records covering patient
  merge state, appointments, SOAP, narrative content, provenance and attachment
  relationships.
- `fixtures/v1-backup.sql` is an actual `mysqldump` of that final synthetic V1
  database; `v1-backup.sql.sha256` makes corruption detectable before restore.

Together they form a reproducible logical backup for migration tests without
shipping real clinical data. The V1 -> V2 converter reads through
`V1_DATABASE_URL` and writes only through `DATABASE_URL`; its runbook is in the
parent [`README.md`](../README.md).

The dump is intentionally MySQL SQL: it is the recoverable source backup. It is
not restored directly into PostgreSQL because V2 has a different clinical data
model. `scripts/migrate-v1-to-v2.ts` performs that semantic conversion.
