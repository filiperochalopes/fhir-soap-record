# soap-ehr

`soap-ehr` is a compact clinical-record application for studying three complementary health-data standards:

- openEHR-inspired archetypes, operational templates, compositions and versioning are the canonical clinical persistence model;
- FHIR remains the interoperability API and import/export surface;
- OMOP CDM will be a derived, read-only analytical projection in the next phase.

The application is intentionally narrow:

- token-based authentication
- patient registry and editing
- agenda with appointment-based attendance entry
- SOAP and narrative note registration
- FHIR-oriented API
- FHIR Bundle import
- Swagger/OpenAPI docs
- Docker-based execution

The implementation stays as a single full-stack monolith and follows `YAGNI`, `DRY`, and `KISS`.

## Stack and Architecture

- React Router v7 in framework mode
- React + TypeScript
- Node.js
- Prisma ORM
- MySQL
- Tailwind CSS
- OpenAPI + Swagger UI
- Docker Compose

Operational rules in this codebase:

- frontend and backend run in the same Node application
- web routes and API routes are served by the same runtime
- the default local stack uses the MySQL container from Docker Compose
- schema changes are versioned through Prisma migrations in `prisma/migrations/`
- Prisma Client remains the typed access layer used by the application
- operational data such as users, patients, appointments and drafts remains relational
- clinical content is stored only as versioned compositions validated against a template
- the API layer projects canonical compositions to FHIR resources
- `prisma/migrations/` contains only the V2 schema; V1 artifacts live exclusively under `docs/migration/v1/`

## Data Architecture

```mermaid
flowchart LR
  Patient --> EhrRecord
  EhrRecord --> Contribution
  EhrRecord --> VersionedComposition
  VersionedComposition --> CompositionVersion
  Contribution --> CompositionVersion
  TemplateDefinition --> CompositionVersion
  ArchetypeDefinition --> CompositionVersion

  CompositionVersion -. projects to .-> FHIRComposition[FHIR Composition]
  CompositionVersion -. projects to .-> FHIRObservation[FHIR Observation]
  CompositionVersion -. projects to .-> FHIRCondition[FHIR Condition]
  CompositionVersion -. future ETL .-> OMOP[OMOP CDM 5.4]
```

## Local Run

1. Install dependencies.

```bash
pnpm install
```

2. Create environment variables.

```bash
cp .env.example .env
```

3. Generate Prisma Client.

```bash
pnpm prisma:generate
```

4. Apply migrations to the database pointed to by `DATABASE_URL`.

```bash
pnpm prisma:migrate:deploy
```

5. Start the application.

```bash
pnpm dev
```

## Docker Run

Use Docker Compose for a full local stack with MySQL and the Node monolith:

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
```

The `soap-ehr-db` MySQL service hosts two isolated databases:

- `soap_ehr`: canonical V2 runtime database;
- `fhir_soap_record`: stale V1 fixture/source database used only by migration tests.

The `soap-ehr` service applies only the V2 migrations to `soap_ehr`.

If ports `3000` or `3306` are already in use on the host, override them with `APP_PORT` and `DB_PORT`.

To run the app against an external MySQL address instead of the bundled `db` service:

```bash
export SOAP_EHR_DATABASE_URL="mysql://user:password@host:3306/soap_ehr"
docker compose -f compose.yml up --build soap-ehr
```

To test S3-compatible attachment storage locally, enable the RustFS override first:

```bash
cp compose.override.yml.bak compose.override.yml
docker compose -f compose.yml -f compose.dev.yml up --build
```

To rebuild the synthetic V1 fixture locally:

```bash
V1_DATABASE_URL="mysql://clinic:clinic@localhost:3306/fhir_soap_record" pnpm v1:migrate:deploy
V1_DATABASE_URL="mysql://clinic:clinic@localhost:3306/fhir_soap_record" pnpm v1:fixture:seed
```

To inspect, run, and independently verify a V1 -> V2 conversion:

```bash
V1_DATABASE_URL="mysql://clinic:clinic@localhost:3306/fhir_soap_record" DATABASE_URL="mysql://clinic:clinic@localhost:3306/soap_ehr" pnpm migrate:v1-to-v2 plan
V1_DATABASE_URL="mysql://clinic:clinic@localhost:3306/fhir_soap_record" DATABASE_URL="mysql://clinic:clinic@localhost:3306/soap_ehr" pnpm migrate:v1-to-v2 run
V1_DATABASE_URL="mysql://clinic:clinic@localhost:3306/fhir_soap_record" DATABASE_URL="mysql://clinic:clinic@localhost:3306/soap_ehr" pnpm migrate:v1-to-v2 verify
```

See the [migration runbook](docs/migration/README.md) before a real cutover.

## Environment Variables

- `DATABASE_URL`: V2 runtime connection string used by Prisma Client
- `SOAP_EHR_DATABASE_URL`: optional Compose override for the V2 runtime database
- `V1_DATABASE_URL`: migration-tool connection string; the application runtime never reads it
- `APP_PORT`: host port published for the web app in Docker Compose
- `APP_URL`: external base URL used in generated docs and examples
- `DB_PORT`: host port published for MySQL in Docker Compose
- `SOAP_EHR_DB_NAME`: V2 database name, default `soap_ehr`
- `V1_DB_NAME`: V1 fixture/source database name, default `fhir_soap_record`
- `DB_USER`: application user created by the bundled MySQL container
- `DB_PASS`: password used by the bundled MySQL container and default local `DATABASE_URL`
- `PORT`: Node application port
- `COOKIE_NAME`: auth cookie name for web login
- `API_DRY_RUN`: when `true`, FHIR API writes are stored in process memory instead of Prisma; restarting the app/container clears the dry-run data
- `MEUEXAME_API_BASE_URL`: base URL that enables the MeuExame attachment plugin
- `DOCS_APP_BASE_URL`: browser-accessible base URL that enables the Docs document-generation integration
- `DOCS_WEBHOOK_BASE_URL`: optional server-to-server base URL sent to Docs as the issued-document webhook target; defaults to `DOCS_APP_BASE_URL`
- `PLUGIN_SECRET_ENCRYPTION_KEY`: base64-encoded 32-byte key used to encrypt per-user plugin tokens

Each user configures their MeuExame token in `/settings`. The token needs
`exams:write` and `exams:read`.

Each user configures their Docs API key in `/settings`. The same API key is used
to derive the AES-256-GCM key for encrypted URL parameter values sent to the
Docs app. In local Docker setups where the browser opens this app through
`http://localhost:<port>` but the Docs API posts webhooks from inside a
container, set `DOCS_WEBHOOK_BASE_URL` to an address reachable by that container,
for example `http://host.docker.internal:<port>`.

## Prisma Usage

This project uses Prisma ORM for schema versioning and Prisma Client for reads, writes, and typing.

Practical rule:

- run `pnpm prisma:generate` after schema changes
- create new schema changes with `pnpm prisma:migrate:dev --name <migration-name>`
- apply committed migrations with `pnpm prisma:migrate:deploy`
- never point `DATABASE_URL` at the V1 database; the two migration histories are intentionally isolated

## Create a User and Token

Create the first clinical user and token with the CLI:

```bash
pnpm create:user
```

The command prompts for full name, CRM, and CRM UF when they are not passed as flags. You can also provide them explicitly:

```bash
pnpm create:user -- --fullName "Dra. Ana Silva" --crm "12345" --crmUf "BA"
```

The token is shown once at creation time. Store it safely and use the same token for:

- login in the web interface
- `Authorization: Bearer <token>` on API requests

## Access Points

With the default local configuration:

- web app: `http://localhost:3000/login`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- FHIR metadata: `http://localhost:3000/fhir/metadata`
- FHIR patient search: `http://localhost:3000/fhir/Patient`
- FHIR Bundle import: `POST http://localhost:3000/fhir`

## Import Notes

The FHIR import endpoint accepts a focused subset of `Bundle` payloads for:

- `Patient`
- `Appointment`
- `Composition` for either SOAP or narrative clinical notes
- referenced `Encounter`, `Observation`, `Condition`, and `ClinicalImpression` when needed to derive SOAP content

For import, the `Patient` can include optional fields such as `identifier`, `telecom`, and `contact`.

For SOAP import, the `Composition` can provide the encounter date in either of these ways:

- directly in `Composition.date`
- indirectly through `Encounter.period.start` referenced by `Composition.encounter`

For narrative import, the `Composition` must carry at least one `section.text.div`. The app stores it as a narrative note and exposes it back through `Composition`.

## Migration Import Tools

The migration helper scripts read fixed file names inside `import/`:

- `import/db_patients.json`
- `import/Prontuario_Docs.md`
- `import/Documentos_Medicos.pdf`

Main commands:

```bash
pnpm import:generate
pnpm import:review
```

To force a full rerun of OCR and LM stages, ignoring cached results:

```bash
pnpm import:generate -- --force-ocr --force-lm
```

The import pipeline also persists cache and manual review state in `import/cache/`.

## Feature Scope

Implemented MVP screens:

- token login
- patient list with search
- patient create/edit
- agenda based on `Appointment`, with attendance entry into SOAP registration
- clinical registration page with SOAP and narrative note forms plus collapsed previous-records section

Implemented API surface:

- `GET /fhir/metadata`
- patient FHIR routes with `GET`, `POST`, `PUT`, and `PATCH`
- appointment FHIR routes with `GET`, `POST`, `PUT`, and `PATCH`, including `_include=Appointment:patient`
- SOAP-derived FHIR routes through `Composition`, `Encounter`, `Observation`, `Condition`, and `ClinicalImpression`
- narrative clinical notes exposed through `Composition`
- `POST /fhir`
- `GET /openapi.json`
- `GET /docs`
