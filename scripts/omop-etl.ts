import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { Client } from "pg";

import { compositionSchema } from "../app/lib/ehr/rm";
import { prisma } from "../app/lib/prisma.server";
import {
  compositionNoteText,
  genderConceptId,
  OMOP_CONCEPT,
  resolveCanonicalPatientIds,
  truncateSourceValue,
} from "./omop/transform";

type Command = "plan" | "run" | "verify";

function requiredUrl(name: "DATABASE_URL" | "OMOP_DATABASE_URL") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestampKey(value: Date) {
  // OMOP's official PostgreSQL DDL uses TIMESTAMP WITHOUT TIME ZONE. Passing a
  // JavaScript Date directly would make node-postgres apply the workstation's
  // UTC offset. Persist the canonical UTC wall time explicitly instead.
  return value.toISOString().slice(0, 23).replace("T", " ");
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function loadSourceSnapshot() {
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const [patients, providers, appointments, versions] = await Promise.all([
        tx.patient.findMany({
          orderBy: { id: "asc" },
          select: {
            active: true,
            birthDate: true,
            gender: true,
            id: true,
            isDraft: true,
            mergedIntoPatientId: true,
            name: true,
          },
        }),
        tx.authUser.findMany({ orderBy: { id: "asc" } }),
        tx.appointment.findMany({ orderBy: { id: "asc" } }),
        tx.compositionVersion.findMany({
          orderBy: [{ encounteredAt: "asc" }, { id: "asc" }],
          select: {
            appointmentId: true,
            committedAt: true,
            composerUserId: true,
            content: true,
            contentHash: true,
            encounteredAt: true,
            id: true,
            templateId: true,
            title: true,
            versionedComposition: {
              select: { ehr: { select: { patientId: true } } },
            },
          },
        }),
      ]);
      return { appointments, patients, providers, versions };
    },
    { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 30_000 },
  );

  const canonicalIds = resolveCanonicalPatientIds(snapshot.patients);
  const eligibleCanonicalPatients = new Map(
    snapshot.patients
      .filter(
        (patient) =>
          patient.mergedIntoPatientId == null &&
          !patient.isDraft &&
          patient.birthDate != null,
      )
      .map((patient) => [patient.id, patient]),
  );
  const canonicalPatientId = (sourcePatientId: number) =>
    canonicalIds.get(sourcePatientId) ?? sourcePatientId;
  const aliases = snapshot.patients.flatMap((patient) => {
    const canonicalId = canonicalPatientId(patient.id);
    return eligibleCanonicalPatients.has(canonicalId)
      ? [{ canonicalPatientId: canonicalId, sourcePatientId: patient.id }]
      : [];
  });
  const visits = snapshot.appointments.flatMap((appointment) => {
    const personId = canonicalPatientId(appointment.patientId);
    return eligibleCanonicalPatients.has(personId)
      ? [{ ...appointment, personId }]
      : [];
  });
  const notes = snapshot.versions.flatMap((version) => {
    const sourcePatientId = version.versionedComposition.ehr.patientId;
    const personId = canonicalPatientId(sourcePatientId);
    if (!eligibleCanonicalPatients.has(personId)) {
      return [];
    }
    const content = compositionSchema.parse(version.content);
    return [
      {
        appointmentId: version.appointmentId,
        committedAt: version.committedAt,
        contentHash: version.contentHash,
        encounteredAt: version.encounteredAt,
        noteText: compositionNoteText(content),
        personId,
        providerId: version.composerUserId,
        sourceId: version.id,
        sourceValue: version.templateId,
        title: version.title,
      },
    ];
  });
  const clinicalDates = new Map<number, Date[]>();
  const addClinicalDate = (personId: number, value: Date) => {
    const values = clinicalDates.get(personId) ?? [];
    values.push(value);
    clinicalDates.set(personId, values);
  };
  for (const visit of visits) {
    addClinicalDate(visit.personId, visit.start);
    addClinicalDate(visit.personId, visit.end);
  }
  for (const note of notes) {
    addClinicalDate(note.personId, note.encounteredAt);
  }
  const observationPeriods = [...clinicalDates.entries()].map(([personId, dates]) => {
    const timestamps = dates.map((date) => date.getTime());
    return {
      endDate: new Date(Math.max(...timestamps)),
      personId,
      startDate: new Date(Math.min(...timestamps)),
    };
  });
  return {
    aliases,
    excludedPatients: snapshot.patients.length - eligibleCanonicalPatients.size,
    notes,
    observationPeriods,
    patients: [...eligibleCanonicalPatients.values()],
    providers: snapshot.providers,
    snapshotAt: new Date(),
    visits,
  };
}

type SourceSnapshot = Awaited<ReturnType<typeof loadSourceSnapshot>>;

async function targetCounts(client: Client) {
  const result = await client.query<{
    notes: string;
    observation_periods: string;
    patients: string;
    providers: string;
    visits: string;
  }>(`
    SELECT
      (SELECT count(*) FROM omop.person)::text AS patients,
      (SELECT count(*) FROM omop.provider)::text AS providers,
      (SELECT count(*) FROM omop.visit_occurrence)::text AS visits,
      (SELECT count(*) FROM omop.note)::text AS notes,
      (SELECT count(*) FROM omop.observation_period)::text AS observation_periods
  `);
  const row = result.rows[0];
  return {
    notes: Number(row.notes),
    observationPeriods: Number(row.observation_periods),
    patients: Number(row.patients),
    providers: Number(row.providers),
    visits: Number(row.visits),
  };
}

function sourceCounts(snapshot: SourceSnapshot) {
  return {
    aliases: snapshot.aliases.length,
    excludedPatients: snapshot.excludedPatients,
    notes: snapshot.notes.length,
    observationPeriods: snapshot.observationPeriods.length,
    patients: snapshot.patients.length,
    providers: snapshot.providers.length,
    visits: snapshot.visits.length,
  };
}

async function allocateNoteId(client: Client, note: SourceSnapshot["notes"][number]) {
  const existing = await client.query<{ target_id: number }>(
    `SELECT target_id
       FROM soap_ehr_etl.source_key_map
      WHERE source_table = 'CompositionVersion'
        AND source_id = $1
        AND target_table = 'note'`,
    [note.sourceId],
  );
  if (existing.rowCount) {
    await client.query(
      `UPDATE soap_ehr_etl.source_key_map
          SET source_hash = $2, transformed_at = now()
        WHERE source_table = 'CompositionVersion'
          AND source_id = $1
          AND target_table = 'note'`,
      [note.sourceId, note.contentHash],
    );
    return existing.rows[0].target_id;
  }
  const allocated = await client.query<{ note_id: number }>(
    "SELECT nextval('soap_ehr_etl.note_id_seq')::integer AS note_id",
  );
  const noteId = allocated.rows[0].note_id;
  await client.query(
    `INSERT INTO soap_ehr_etl.source_key_map (
       source_table, source_id, target_table, target_id, source_hash
     ) VALUES ('CompositionVersion', $1, 'note', $2, $3)`,
    [note.sourceId, noteId, note.contentHash],
  );
  return noteId;
}

async function replaceAnalyticalSnapshot(client: Client, snapshot: SourceSnapshot) {
  await client.query("BEGIN");
  try {
    // This ETL owns these five CDM tables. Refuse to cascade into future domains:
    // if a new domain depends on them, its ETL must be added to this transaction.
    await client.query("DELETE FROM omop.note");
    await client.query("DELETE FROM omop.observation_period");
    await client.query("DELETE FROM omop.visit_occurrence");
    await client.query("DELETE FROM omop.provider");
    await client.query("DELETE FROM omop.person");
    await client.query("DELETE FROM soap_ehr_etl.person_alias");

    for (const alias of snapshot.aliases) {
      await client.query(
        `INSERT INTO soap_ehr_etl.person_alias (
           source_patient_id, canonical_patient_id
         ) VALUES ($1, $2)`,
        [alias.sourcePatientId, alias.canonicalPatientId],
      );
    }

    for (const provider of snapshot.providers) {
      await client.query(
        `INSERT INTO omop.provider (
           provider_id, provider_name, specialty_concept_id,
           provider_source_value, specialty_source_concept_id,
           gender_source_concept_id
         ) VALUES ($1, $2, 0, $3, 0, 0)`,
        [
          provider.id,
          provider.fullName,
          truncateSourceValue(`CRM:${provider.crm}/${provider.crmUf}`, 50),
        ],
      );
    }

    for (const patient of snapshot.patients) {
      const birthDate = patient.birthDate;
      if (!birthDate) {
        throw new Error(`Eligible Patient/${patient.id} has no birth date.`);
      }
      await client.query(
        `INSERT INTO omop.person (
           person_id, gender_concept_id, year_of_birth, month_of_birth,
           day_of_birth, birth_datetime, race_concept_id, ethnicity_concept_id,
           person_source_value, gender_source_value, gender_source_concept_id,
           race_source_concept_id, ethnicity_source_concept_id
         ) VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8, 0, 0, 0)`,
        [
          patient.id,
          genderConceptId(patient.gender),
          birthDate.getUTCFullYear(),
          birthDate.getUTCMonth() + 1,
          birthDate.getUTCDate(),
          timestampKey(birthDate),
          truncateSourceValue(`Patient/${patient.id}`, 50),
          truncateSourceValue(patient.gender, 50),
        ],
      );
    }

    const providerByAppointment = new Map<number, number>();
    for (const note of snapshot.notes) {
      if (note.appointmentId != null && !providerByAppointment.has(note.appointmentId)) {
        providerByAppointment.set(note.appointmentId, note.providerId);
      }
    }
    const visitsByPerson = new Map<number, SourceSnapshot["visits"]>();
    for (const visit of [...snapshot.visits].sort(
      (left, right) => left.start.getTime() - right.start.getTime() || left.id - right.id,
    )) {
      const visits = visitsByPerson.get(visit.personId) ?? [];
      visits.push(visit);
      visitsByPerson.set(visit.personId, visits);
    }
    for (const visits of visitsByPerson.values()) {
      let precedingVisitId: number | null = null;
      for (const visit of visits) {
        if (visit.end < visit.start) {
          throw new Error(`Appointment/${visit.id} ends before it starts.`);
        }
        await client.query(
          `INSERT INTO omop.visit_occurrence (
             visit_occurrence_id, person_id, visit_concept_id,
             visit_start_date, visit_start_datetime, visit_end_date,
             visit_end_datetime, visit_type_concept_id, provider_id,
             visit_source_value, visit_source_concept_id,
             admitted_from_concept_id, discharged_to_concept_id,
             preceding_visit_occurrence_id
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, 0, $11
           )`,
          [
            visit.id,
            visit.personId,
            OMOP_CONCEPT.outpatientVisit,
            dateKey(visit.start),
            timestampKey(visit.start),
            dateKey(visit.end),
            timestampKey(visit.end),
            OMOP_CONCEPT.ehrType,
            providerByAppointment.get(visit.id) ?? null,
            truncateSourceValue(visit.appointmentType, 50),
            precedingVisitId,
          ],
        );
        precedingVisitId = visit.id;
      }
    }

    for (const note of snapshot.notes) {
      const noteId = await allocateNoteId(client, note);
      await client.query(
        `INSERT INTO omop.note (
           note_id, person_id, note_date, note_datetime, note_type_concept_id,
           note_class_concept_id, note_title, note_text, encoding_concept_id,
           language_concept_id, provider_id, visit_occurrence_id,
           note_source_value, note_event_field_concept_id
         ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 0, 0, $8, $9, $10, 0)`,
        [
          noteId,
          note.personId,
          dateKey(note.encounteredAt),
          timestampKey(note.encounteredAt),
          OMOP_CONCEPT.ehrType,
          truncateSourceValue(note.title, 250),
          note.noteText,
          note.providerId,
          note.appointmentId,
          truncateSourceValue(note.sourceValue, 50),
        ],
      );
    }

    for (const period of snapshot.observationPeriods) {
      await client.query(
        `INSERT INTO omop.observation_period (
           observation_period_id, person_id, observation_period_start_date,
           observation_period_end_date, period_type_concept_id
         ) VALUES ($1, $1, $2, $3, $4)`,
        [
          period.personId,
          dateKey(period.startDate),
          dateKey(period.endDate),
          OMOP_CONCEPT.ehrType,
        ],
      );
    }

    await client.query("DELETE FROM omop.cdm_source WHERE cdm_source_abbreviation = 'soap-ehr'");
    await client.query(
      `INSERT INTO omop.cdm_source (
         cdm_source_name, cdm_source_abbreviation, cdm_holder,
         source_description, source_documentation_reference, cdm_etl_reference,
         source_release_date, cdm_release_date, cdm_version,
         cdm_version_concept_id, vocabulary_version
       ) VALUES (
         'soap-ehr analytical projection', 'soap-ehr', 'soap-ehr local operator',
         'Derived read-only OMOP projection of canonical soap-ehr compositions.',
         'docs/omop.md', 'scripts/omop-etl.ts', $1, DATE '2024-09-30',
         '5.4.2', 0, 'bootstrap-2026-08'
       )`,
      [dateKey(snapshot.snapshotAt)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function sourceNoteDigest(snapshot: SourceSnapshot) {
  return digest(
    snapshot.notes
      .map((note) => ({
        noteClassConceptId: 0,
        noteDate: dateKey(note.encounteredAt),
        noteDatetime: note.encounteredAt.toISOString(),
        noteSourceValue: truncateSourceValue(note.sourceValue, 50),
        noteText: note.noteText,
        noteTitle: truncateSourceValue(note.title, 250),
        noteTypeConceptId: OMOP_CONCEPT.ehrType,
        personId: note.personId,
        providerId: note.providerId,
        sourceId: note.sourceId,
        visitOccurrenceId: note.appointmentId,
      }))
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
  );
}

async function targetNoteDigest(client: Client) {
  const result = await client.query<{
    note_class_concept_id: number;
    note_date: string;
    note_datetime: string;
    note_source_value: string;
    note_text: string;
    note_title: string;
    note_type_concept_id: number;
    person_id: number;
    provider_id: number;
    source_id: string;
    visit_occurrence_id: number | null;
  }>(`
    SELECT
      map.source_id,
      note.person_id,
      to_char(note.note_date, 'YYYY-MM-DD') AS note_date,
      to_char(note.note_datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS note_datetime,
      note.note_type_concept_id,
      note.note_class_concept_id,
      note.note_title,
      note.note_text,
      note.provider_id,
      note.visit_occurrence_id,
      note.note_source_value
    FROM soap_ehr_etl.source_key_map map
    JOIN omop.note note ON note.note_id = map.target_id
    WHERE map.source_table = 'CompositionVersion'
      AND map.target_table = 'note'
    ORDER BY map.source_id
  `);
  return digest(
    result.rows
      .map((row) => ({
        noteClassConceptId: row.note_class_concept_id,
        noteDate: row.note_date,
        noteDatetime: row.note_datetime,
        noteSourceValue: row.note_source_value,
        noteText: row.note_text,
        noteTitle: row.note_title,
        noteTypeConceptId: row.note_type_concept_id,
        personId: row.person_id,
        providerId: row.provider_id,
        sourceId: row.source_id,
        visitOccurrenceId: row.visit_occurrence_id,
      }))
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
  );
}

async function verifySnapshot(client: Client, snapshot: SourceSnapshot) {
  const source = sourceCounts(snapshot);
  const target = await targetCounts(client);
  const cdmTables = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM information_schema.tables
      WHERE table_schema = 'omop'
        AND table_type = 'BASE TABLE'`,
  );
  const aliases = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM soap_ehr_etl.person_alias",
  );
  const checks: Array<{ actual: number | string; expected: number | string; name: string }> = [
    { actual: Number(cdmTables.rows[0].count), expected: 39, name: "OMOP_CDM_TABLES" },
    { actual: target.patients, expected: source.patients, name: "PERSON" },
    { actual: target.providers, expected: source.providers, name: "PROVIDER" },
    { actual: target.visits, expected: source.visits, name: "VISIT_OCCURRENCE" },
    { actual: target.notes, expected: source.notes, name: "NOTE" },
    {
      actual: target.observationPeriods,
      expected: source.observationPeriods,
      name: "OBSERVATION_PERIOD",
    },
    { actual: Number(aliases.rows[0].count), expected: source.aliases, name: "PERSON_ALIAS" },
  ];
  const sourceDigest = sourceNoteDigest(snapshot);
  const targetDigest = await targetNoteDigest(client);
  checks.push({ actual: targetDigest, expected: sourceDigest, name: "NOTE_CONTENT_SHA256" });
  const orphanResult = await client.query<{ count: string }>(`
    SELECT (
      (SELECT count(*) FROM omop.visit_occurrence visit
        LEFT JOIN omop.person person ON person.person_id = visit.person_id
       WHERE person.person_id IS NULL) +
      (SELECT count(*) FROM omop.note note
        LEFT JOIN omop.person person ON person.person_id = note.person_id
       WHERE person.person_id IS NULL) +
      (SELECT count(*) FROM omop.note note
        LEFT JOIN omop.provider provider ON provider.provider_id = note.provider_id
       WHERE note.provider_id IS NOT NULL AND provider.provider_id IS NULL) +
      (SELECT count(*) FROM omop.note note
        LEFT JOIN omop.visit_occurrence visit ON visit.visit_occurrence_id = note.visit_occurrence_id
       WHERE note.visit_occurrence_id IS NOT NULL AND visit.visit_occurrence_id IS NULL)
    )::text AS count
  `);
  checks.push({ actual: Number(orphanResult.rows[0].count), expected: 0, name: "ORPHAN_LINKS" });
  const mismatches = checks.filter((check) => check.actual !== check.expected);
  const report = {
    checks,
    excludedPatients: source.excludedPatients,
    mismatches,
    result: mismatches.length ? "failed" : "verified",
    sourceNoteDigest: sourceDigest,
  };
  if (mismatches.length) {
    throw new Error(`OMOP verification failed:\n${JSON.stringify(report, null, 2)}`);
  }
  return report;
}

async function runEtl(client: Client, snapshot: SourceSnapshot) {
  const runId = randomUUID();
  const startedAt = new Date();
  await client.query(
    `INSERT INTO soap_ehr_etl.etl_run (
       run_id, status, started_at, source_snapshot_at
     ) VALUES ($1, 'running', $2, $3)`,
    [runId, startedAt, snapshot.snapshotAt],
  );
  try {
    await replaceAnalyticalSnapshot(client, snapshot);
    const report = await verifySnapshot(client, snapshot);
    await client.query(
      `UPDATE soap_ehr_etl.etl_run
          SET status = 'completed', completed_at = now(), statistics = $2::jsonb
        WHERE run_id = $1`,
      [runId, JSON.stringify(report)],
    );
    return { runId, ...report };
  } catch (error) {
    await client.query(
      `UPDATE soap_ehr_etl.etl_run
          SET status = 'failed', completed_at = now(), error_message = $2
        WHERE run_id = $1`,
      [runId, error instanceof Error ? error.message : String(error)],
    );
    throw error;
  }
}

async function main() {
  const command = process.argv[2] as Command | undefined;
  if (!command || !["plan", "run", "verify"].includes(command)) {
    throw new Error("Usage: pnpm omop:etl <plan|run|verify>");
  }
  requiredUrl("DATABASE_URL");
  const client = new Client({ connectionString: requiredUrl("OMOP_DATABASE_URL") });
  await client.connect();
  try {
    const snapshot = await loadSourceSnapshot();
    if (command === "plan") {
      console.log(
        JSON.stringify(
          { source: sourceCounts(snapshot), target: await targetCounts(client) },
          null,
          2,
        ),
      );
      return;
    }
    const report =
      command === "run"
        ? await runEtl(client, snapshot)
        : await verifySnapshot(client, snapshot);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
