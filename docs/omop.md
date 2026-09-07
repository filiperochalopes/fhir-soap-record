# OMOP analytical projection

`soap-ehr` uses OMOP CDM 5.4.2 as a derived research projection. The clinical
source of truth remains the canonical tables in the PostgreSQL `soap_ehr`
database. The CDM lives in the `omop` schema and ETL metadata in
`soap_ehr_etl`; no web request reads from either and the ETL never writes back
to the EHR tables in `public`.

The PostgreSQL DDL, primary keys, constraints and indexes under
`omop/schema/official/` are unmodified files from the official OHDSI
`CommonDataModel` tag `v5.4.2`. PostgreSQL is used because MySQL is not one of
the DDL dialects published for that release.

Official references:

- https://ohdsi.github.io/CommonDataModel/cdm54.html
- https://github.com/OHDSI/CommonDataModel/releases/tag/v5.4.2
- https://ohdsi.github.io/CommonDataModel/dataModelConventions.html

## Current ETL mapping

| soap-ehr source | OMOP destination | Rule |
| --- | --- | --- |
| canonical, non-draft `Patient` with birth date | `PERSON` | merged records resolve to one canonical person; gender maps to 8507/8532 when known |
| `Patient.mergedIntoPatientId` | `soap_ehr_etl.person_alias` | preserves every source patient identifier and its canonical person |
| `AuthUser` | `PROVIDER` | CRM/UF is retained as the source value |
| `Appointment` | `VISIT_OCCURRENCE` | private-office interaction maps to Outpatient Visit (9202), with EHR provenance (32817) |
| `CompositionVersion` | `NOTE` | the complete ordered section text is retained; the note uses EHR provenance (32817) |
| first/last recorded appointment or composition date | `OBSERVATION_PERIOD` | one bounded period per person with recorded clinical activity |
| extraction metadata | `CDM_SOURCE` and `soap_ehr_etl.etl_run` | identifies CDM/ETL versions and records every successful or failed run |

SOAP prose is deliberately not guessed into `CONDITION_OCCURRENCE`,
`MEASUREMENT`, `DRUG_EXPOSURE` or `OBSERVATION`. Those domains require coded,
domain-correct facts. The complete narrative remains in `NOTE` until structured
openEHR elements, source terminology codes or a reviewed NLP pipeline can supply
safe mappings.

## Vocabulary boundary

The local stack includes only a bootstrap vocabulary sufficient for executable
tests:

- concept 0, no matching concept;
- 8507, Male;
- 8532, Female;
- 9202, Outpatient Visit;
- 32817, EHR.

This bootstrap is not a substitute for the OHDSI Standardized Vocabularies. A
real research environment must load a licensed Athena export, document its
version in `CDM_SOURCE`, review mappings (for example with Usagi), and run the
OHDSI Data Quality Dashboard before analysis or federation.

## Local execution

Start the shared PostgreSQL database and install the pinned CDM schema:

```bash
docker compose -f compose.yml -f compose.dev.yml --profile omop up -d \
  soap-ehr-db soap-ehr-omop-init
```

Inspect, execute and independently verify a snapshot:

```bash
DATABASE_URL="postgresql://clinic:clinic@127.0.0.1:5438/soap_ehr" \
OMOP_DATABASE_URL="postgresql://clinic:clinic@127.0.0.1:5438/soap_ehr" \
pnpm omop:etl plan

DATABASE_URL="postgresql://clinic:clinic@127.0.0.1:5438/soap_ehr" \
OMOP_DATABASE_URL="postgresql://clinic:clinic@127.0.0.1:5438/soap_ehr" \
pnpm omop:etl run

DATABASE_URL="postgresql://clinic:clinic@127.0.0.1:5438/soap_ehr" \
OMOP_DATABASE_URL="postgresql://clinic:clinic@127.0.0.1:5438/soap_ehr" \
pnpm omop:etl verify
```

Each run replaces the five currently managed CDM tables in one PostgreSQL
transaction. Source-to-note keys remain stable across runs. Verification compares
counts, foreign-key links and a SHA-256 digest of every transformed note field.
The ETL explicitly serializes UTC wall time because the official CDM fields use
PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`.
