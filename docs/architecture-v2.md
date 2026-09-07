# soap-ehr V2 architecture

## Boundaries

The V2 runtime has one canonical clinical model. `SoapNote` and `NarrativeNote`
are not tables, compatibility views or fallback read paths.

Operational records remain relational:

- `Patient`, demographics and patient merge state;
- `AuthUser`, tokens, plugin credentials and audit events;
- `Appointment`, encrypted browser drafts and attachment workflow.

Clinical records use a deliberately small openEHR-inspired kernel:

- `EhrRecord` is the patient-scoped record root;
- `Contribution` is the auditable commit/change set;
- `VersionedComposition` owns the logical clinical document identity;
- `CompositionVersion` is immutable clinical content with a preceding-version link;
- `ArchetypeDefinition` and `TemplateDefinition` are executable knowledge artifacts;
- `ClinicalAttachment` points to the exact composition version it accompanies.

This educational kernel follows the openEHR separation of reference model,
archetypes and templates but does not claim full openEHR platform conformance.
Full conformance would additionally require the complete RM, OPT/ADL processing,
REST service contracts and AQL semantics.

## Canonical SOAP template

`soap-ehr.template.encounter-soap.v1` constrains a consultation composition to:

| Node | Section | RM entry | Narrative archetype |
| --- | --- | --- | --- |
| `at0001` | Subjective | `OBSERVATION` | `openEHR-EHR-OBSERVATION.story.v1` |
| `at0002` | Objective | `OBSERVATION` | `openEHR-EHR-OBSERVATION.clinical_exam.v1` |
| `at0003` | Assessment | `EVALUATION` | `openEHR-EHR-EVALUATION.clinical_assessment.v1` |
| `at0004` | Plan | `EVALUATION` | `openEHR-EHR-EVALUATION.care_plan.v1` |

The plan remains an `EVALUATION` during V1 migration because historical free
text may mix advice, follow-up, prescriptions and requests. Future structured
orders can use dedicated `INSTRUCTION` archetypes without reinterpreting old text.

Each save validates the JSON composition, hashes the canonical content and
commits the EHR root, contribution, logical composition and first version in one
database transaction. Draft attachments are promoted only inside that same
successful transaction.

## FHIR boundary

FHIR resources are projections, never a second clinical source of truth:

- consultation context -> `Encounter`;
- objective narrative -> `Observation`;
- assessment narrative -> `Condition` and `ClinicalImpression`;
- the full template -> `Composition`;
- attachment metadata -> `DocumentReference`.

FHIR imports are normalized into a validated composition before commit.

## Database isolation

V1 and V2 use different engines during migration:

```text
soap-ehr-db-legacy (MySQL)
└── fhir_soap_record  V1 source/fixture; stale and migration-only

soap-ehr-db (PostgreSQL)
└── soap_ehr
    └── public        V2 canonical runtime
```

The V1 migration history and deterministic synthetic fixture live under
`docs/migration/v1/`. Active Prisma migrations contain only the clean V2 initial
schema. This prevents `prisma migrate deploy` from dropping or modifying a V1
database accidentally.

The standalone converter is the only bridge between the schemas. It preserves
operational IDs/timestamps, records original clinical provenance in
`CompositionVersion.sourceMetadata`, and validates complete operational-row and
canonical clinical-content hashes before reporting success. See
[`migration/README.md`](migration/README.md).
