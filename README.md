# FHIR SOAP Record MVP

This repository is a study-oriented FHIR project and a usable MVP for a private clinical office workflow while OpenMRS is not yet ready in Portuguese for this specific use case.

The application is intentionally narrow:

- token-based authentication
- patient registry and editing
- read-only agenda
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
- internal persistence stays workflow-oriented, while the API layer exposes FHIR-aligned resources

## Entity and FHIR Diagram

```mermaid
graph TD
  Patient --> Identifier
  Patient --> ContactPoint
  Patient --> Contact
  Patient --> Appointment
  Patient --> SoapNote
  AuthUser --> AuthToken
  AuthUser --> SoapNote
  AuthUser --> AuditLog

  Patient -. maps to .-> FHIRPatient[FHIR Patient]
  Appointment -. maps to .-> FHIRAppointment[FHIR Appointment]
  SoapNote -. maps to .-> FHIRComposition[FHIR Composition]
  SoapNote -. maps to .-> FHIRClinicalImpression[FHIR ClinicalImpression]
  SoapNote -. maps to .-> FHIRObservation[FHIR Observation]
  SoapNote -. maps to .-> FHIRCondition[FHIR Condition]
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
docker compose up --build
```

The `db` service creates the empty `fhir_soap_record` database, and the `app` service applies Prisma migrations automatically on startup.

If ports `3000` or `3306` are already in use on the host, override them with `APP_PORT` and `DB_PORT`.

To run the app against an external MySQL address instead of the bundled `db` service:

```bash
export DATABASE_URL="mysql://user:password@host:3306/database"
docker compose -f docker-compose.yml -f docker-compose.external.yml up --build app
```

If that external database already has the application tables and was not created by Prisma Migrate, baseline it once before the first deploy:

```bash
pnpm prisma:migrate:resolve --applied 20260322000000_init
pnpm prisma:migrate:deploy
```

## Environment Variables

- `DATABASE_URL`: MySQL connection string used by Prisma Client
- `APP_PORT`: host port published for the web app in Docker Compose
- `APP_URL`: external base URL used in generated docs and examples
- `DB_PORT`: host port published for MySQL in Docker Compose
- `DB_NAME`: database name created by the bundled MySQL container
- `DB_USER`: application user created by the bundled MySQL container
- `DB_PASS`: password used by the bundled MySQL container and default local `DATABASE_URL`
- `PORT`: Node application port
- `COOKIE_NAME`: auth cookie name for web login

## Prisma Usage

This project uses Prisma ORM for schema versioning and Prisma Client for reads, writes, and typing.

Practical rule:

- run `pnpm prisma:generate` after schema changes
- create new schema changes with `pnpm prisma:migrate:dev --name <migration-name>`
- apply committed migrations with `pnpm prisma:migrate:deploy`
- when adopting an existing external schema, mark the initial migration as applied before deploying further changes

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
- read-only agenda based on `Appointment`
- clinical registration page with SOAP and narrative note forms plus collapsed previous-records section

Implemented API surface:

- `GET /fhir/metadata`
- patient FHIR routes
- appointment FHIR routes
- SOAP-derived FHIR routes through `Composition`, `Encounter`, `Observation`, `Condition`, and `ClinicalImpression`
- narrative clinical notes exposed through `Composition`
- `POST /fhir`
- `GET /openapi.json`
- `GET /docs`
