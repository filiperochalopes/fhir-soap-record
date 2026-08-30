# V1 to V2 migration runbook

The converter reads the old `fhir_soap_record` database and writes the clean
`soap_ehr` database. The V2 application never reads V1 tables at runtime.

## Safety contract

- Take and verify a production backup before a real cutover.
- Stop V1 writes during the final conversion window.
- Point `V1_DATABASE_URL` and `DATABASE_URL` at different databases.
- Start with an empty V2 database containing only the committed V2 migrations.
- Keep the V1 database stale after cutover; do not drop it as part of this script.

The converter refuses a populated target unless it contains its own resumable
migration marker. Source timestamps are interpreted as UTC MySQL `DATETIME`
values so the conversion does not apply the workstation's timezone offset.

## Commands

```bash
V1_DATABASE_URL="mysql://user:password@host:3306/fhir_soap_record" \
DATABASE_URL="mysql://user:password@host:3306/soap_ehr" \
pnpm migrate:v1-to-v2 plan

V1_DATABASE_URL="mysql://user:password@host:3306/fhir_soap_record" \
DATABASE_URL="mysql://user:password@host:3306/soap_ehr" \
pnpm migrate:v1-to-v2 run

V1_DATABASE_URL="mysql://user:password@host:3306/fhir_soap_record" \
DATABASE_URL="mysql://user:password@host:3306/soap_ehr" \
pnpm migrate:v1-to-v2 verify
```

`run` is resumable and idempotent for the same source. It preserves relational
IDs and timestamps, converts SOAP and narrative notes into canonical composition
versions, records V1 provenance, reconnects attachments, and then performs the
same checks as `verify`.

Verification compares row counts, attachment-to-composition links, a canonical
clinical-content SHA-256 digest, and full operational-row SHA-256 digests for
every copied table. Migration-only settings and new V2 clinical audit events are
excluded from the V1 equality digest because they have no V1 counterpart.

The deterministic, entirely synthetic V1 migrations and fixture are under
[`v1/`](v1/README.md).
