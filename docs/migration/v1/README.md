# V1 synthetic migration fixture

This documentation directory is the only retained V1 artifact. It is not
imported or copied into the soap-ehr runtime image.

- `prisma/migrations/` rebuilds the final V1 schema.
- `fixtures/seed-v1.sql` adds deterministic synthetic records covering patient
  merge state, appointments, SOAP, narrative content, provenance and attachment
  relationships.

Together they form a reproducible logical backup for migration tests without
shipping real clinical data. The V1 -> V2 converter reads through
`V1_DATABASE_URL` and writes only through `DATABASE_URL`; its runbook is in the
parent [`README.md`](../README.md).
