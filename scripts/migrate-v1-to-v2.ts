import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { Client, types as pgTypes } from "pg";

import {
  createNarrativeComposition,
  createSoapComposition,
  getClinicalCompositions,
} from "../app/lib/ehr/compositions.server";
import { prisma } from "../app/lib/prisma.server";
import type { NarrativeSection } from "../app/lib/narrative-notes";

type V1Row = RowDataPacket & Record<string, unknown>;
type PostgreSqlRow = Record<string, unknown>;
type MigrationCommand = "plan" | "run" | "verify";

const V1_SOAP_SOURCE = "soap-ehr-v1:SoapNote";
const V1_NARRATIVE_SOURCE = "soap-ehr-v1:NarrativeNote";
const MIGRATION_STARTED_ID = -1;
const MIGRATION_COMPLETED_ID = -2;

// Prisma and the V1 reader treat historical timezone-less values as UTC wall
// time. Keep raw PostgreSQL verification queries on the same convention.
pgTypes.setTypeParser(1082, (value) => new Date(`${value}T00:00:00.000Z`));
pgTypes.setTypeParser(1114, (value) => new Date(`${value.replace(" ", "T")}Z`));

function requiredUrl(name: "DATABASE_URL" | "V1_DATABASE_URL") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function databaseName(url: string) {
  return new URL(url).pathname.replace(/^\//, "");
}

function assertSeparateDatabases(v1Url: string, v2Url: string) {
  const v1 = new URL(v1Url);
  const v2 = new URL(v2Url);
  if (v1.protocol !== "mysql:") {
    throw new Error("V1_DATABASE_URL must point to the legacy MySQL database.");
  }
  if (!["postgres:", "postgresql:"].includes(v2.protocol)) {
    throw new Error("DATABASE_URL must point to the V2 PostgreSQL database.");
  }
  if (v1.host === v2.host && databaseName(v1Url) === databaseName(v2Url)) {
    throw new Error("V1_DATABASE_URL and DATABASE_URL must point to different databases.");
  }
}

function asDate(value: unknown, field: string) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}: ${String(value)}`);
  }
  return date;
}

function nullableDate(value: unknown) {
  return value == null ? null : asDate(value, "date");
}

function asNumber(value: unknown) {
  return Number(value);
}

function asNullableNumber(value: unknown) {
  return value == null ? null : Number(value);
}

function parseJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

function narrativeSections(value: unknown): NarrativeSection[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error("NarrativeNote.sections must be a JSON array.");
  }
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`NarrativeNote section ${index + 1} is invalid.`);
    }
    const record = item as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : "";
    if (!text) {
      throw new Error(`NarrativeNote section ${index + 1} has no text.`);
    }
    return {
      text,
      title: typeof record.title === "string" ? record.title : "",
    };
  });
}

async function queryRows(connection: mysql.Connection, sql: string) {
  const [rows] = await connection.query<V1Row[]>(sql);
  return rows;
}

async function queryPostgreSqlRows(
  connection: Client,
  sql: string,
  values: readonly unknown[] = [],
) {
  const result = await connection.query<PostgreSqlRow>(sql, [...values]);
  return result.rows;
}

async function scalarCount(connection: mysql.Connection, table: string) {
  const [row] = await queryRows(
    connection,
    `SELECT COUNT(*) AS count FROM \`${table}\``,
  );
  return Number(row?.count ?? 0);
}

async function sourceCounts(connection: mysql.Connection) {
  const tables = [
    "Patient",
    "Contact",
    "ContactPoint",
    "Identifier",
    "Appointment",
    "GeneralSetting",
    "AuthUser",
    "AuthToken",
    "SoapNote",
    "NarrativeNote",
    "EncounterDraft",
    "ClinicalAttachment",
    "AttachmentPluginExecution",
    "UserPluginCredential",
    "ClinicalDocumentWebhookEvent",
    "AuditLog",
  ] as const;
  return Object.fromEntries(
    await Promise.all(tables.map(async (table) => [table, await scalarCount(connection, table)])),
  ) as Record<(typeof tables)[number], number>;
}

async function targetCounts() {
  const [
    patients,
    contacts,
    contactPoints,
    identifiers,
    appointments,
    settings,
    users,
    tokens,
    compositions,
    drafts,
    attachments,
    pluginExecutions,
    pluginCredentials,
    webhookEvents,
    auditLogs,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.contact.count(),
    prisma.contactPoint.count(),
    prisma.identifier.count(),
    prisma.appointment.count(),
    prisma.generalSetting.count(),
    prisma.authUser.count(),
    prisma.authToken.count(),
    prisma.compositionVersion.count(),
    prisma.encounterDraft.count(),
    prisma.clinicalAttachment.count(),
    prisma.attachmentPluginExecution.count(),
    prisma.userPluginCredential.count(),
    prisma.clinicalDocumentWebhookEvent.count(),
    prisma.auditLog.count(),
  ]);
  return {
    Appointment: appointments,
    AttachmentPluginExecution: pluginExecutions,
    AuditLog: auditLogs,
    AuthToken: tokens,
    AuthUser: users,
    ClinicalAttachment: attachments,
    ClinicalDocumentWebhookEvent: webhookEvents,
    CompositionVersion: compositions,
    Contact: contacts,
    ContactPoint: contactPoints,
    EncounterDraft: drafts,
    GeneralSetting: settings,
    Identifier: identifiers,
    Patient: patients,
    UserPluginCredential: pluginCredentials,
  };
}

async function assertTargetReadyForRun() {
  const started = await prisma.generalSetting.findUnique({
    where: { property: "migration.v1.startedAt" },
  });
  if (started) {
    return;
  }
  const counts = await targetCounts();
  const occupied = Object.entries(counts).filter(([, count]) => count > 0);
  if (occupied.length) {
    throw new Error(
      `V2 target is not empty and has no resumable migration marker: ${occupied
        .map(([table, count]) => `${table}=${count}`)
        .join(", ")}`,
    );
  }
}

async function copyOperationalData(connection: mysql.Connection) {
  const users = await queryRows(connection, "SELECT * FROM `AuthUser` ORDER BY `id`");
  for (const row of users) {
    await prisma.authUser.upsert({
      where: { id: asNumber(row.id) },
      create: {
        createdAt: asDate(row.created_at, "AuthUser.created_at"),
        crm: String(row.crm),
        crmUf: String(row.crm_uf),
        fullName: String(row.full_name),
        id: asNumber(row.id),
        isActive: Boolean(row.is_active),
        updatedAt: asDate(row.updated_at, "AuthUser.updated_at"),
      },
      update: {},
    });
  }

  const patients = await queryRows(connection, "SELECT * FROM `Patient` ORDER BY `id`");
  for (const row of patients) {
    await prisma.patient.upsert({
      where: { id: asNumber(row.id) },
      create: {
        active: Boolean(row.active),
        birthDate: nullableDate(row.birth_date),
        createdAt: asDate(row.created_at, "Patient.created_at"),
        gender: String(row.gender),
        id: asNumber(row.id),
        isDraft: Boolean(row.is_draft),
        name: String(row.name),
        updatedAt: asDate(row.updated_at, "Patient.updated_at"),
      },
      update: {},
    });
  }
  for (const row of patients) {
    if (row.merged_into_patient_id != null) {
      await prisma.patient.update({
        where: { id: asNumber(row.id) },
        data: {
          mergedIntoPatientId: asNumber(row.merged_into_patient_id),
          updatedAt: asDate(row.updated_at, "Patient.updated_at"),
        },
      });
    }
  }

  for (const row of await queryRows(connection, "SELECT * FROM `Contact` ORDER BY `id`")) {
    await prisma.contact.upsert({
      where: { id: asNumber(row.id) },
      create: {
        createdAt: asDate(row.created_at, "Contact.created_at"),
        id: asNumber(row.id),
        name: String(row.name),
        patientId: asNumber(row.patient_id),
        relationship: String(row.relationship),
        updatedAt: asDate(row.updated_at, "Contact.updated_at"),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `ContactPoint` ORDER BY `id`")) {
    await prisma.contactPoint.upsert({
      where: { id: asNumber(row.id) },
      create: {
        createdAt: asDate(row.created_at, "ContactPoint.created_at"),
        id: asNumber(row.id),
        patientId: asNullableNumber(row.patient_id),
        system: String(row.system),
        updatedAt: asDate(row.updated_at, "ContactPoint.updated_at"),
        value: String(row.value),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `Identifier` ORDER BY `id`")) {
    await prisma.identifier.upsert({
      where: { id: asNumber(row.id) },
      create: {
        createdAt: asDate(row.created_at, "Identifier.created_at"),
        id: asNumber(row.id),
        patientId: asNullableNumber(row.patient_id),
        system: String(row.system),
        updatedAt: asDate(row.updated_at, "Identifier.updated_at"),
        value: String(row.value),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `Appointment` ORDER BY `id`")) {
    await prisma.appointment.upsert({
      where: { id: asNumber(row.id) },
      create: {
        appointmentType: String(row.appointment_type),
        createdAt: asDate(row.created_at, "Appointment.created_at"),
        end: asDate(row.end, "Appointment.end"),
        id: asNumber(row.id),
        patientId: asNumber(row.patient_id),
        start: asDate(row.start, "Appointment.start"),
        status: String(row.status),
        updatedAt: asDate(row.updated_at, "Appointment.updated_at"),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `AuthToken` ORDER BY `id`")) {
    await prisma.authToken.upsert({
      where: { id: asNumber(row.id) },
      create: {
        createdAt: asDate(row.created_at, "AuthToken.created_at"),
        id: asNumber(row.id),
        isActive: Boolean(row.is_active),
        lastUsedAt: nullableDate(row.last_used_at),
        revokedAt: nullableDate(row.revoked_at),
        tokenHash: String(row.token_hash),
        updatedAt: asDate(row.updated_at, "AuthToken.updated_at"),
        userId: asNumber(row.user_id),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `GeneralSetting` ORDER BY `id`")) {
    await prisma.generalSetting.upsert({
      where: { property: String(row.property) },
      create: {
        createdAt: asDate(row.created_at, "GeneralSetting.created_at"),
        id: asNumber(row.id),
        property: String(row.property),
        updatedAt: asDate(row.updated_at, "GeneralSetting.updated_at"),
        value: String(row.value),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `EncounterDraft` ORDER BY `id`")) {
    await prisma.encounterDraft.upsert({
      where: { id: asNumber(row.id) },
      create: {
        appointmentId: asNullableNumber(row.appointment_id),
        authorUserId: asNumber(row.author_user_id),
        createdAt: asDate(row.created_at, "EncounterDraft.created_at"),
        draftKey: String(row.draft_key),
        expiresAt: asDate(row.expires_at, "EncounterDraft.expires_at"),
        id: asNumber(row.id),
        noteType: String(row.note_type),
        patientId: asNumber(row.patient_id),
        status: String(row.status),
        updatedAt: asDate(row.updated_at, "EncounterDraft.updated_at"),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `UserPluginCredential` ORDER BY `id`")) {
    await prisma.userPluginCredential.upsert({
      where: { id: asNumber(row.id) },
      create: {
        createdAt: asDate(row.created_at, "UserPluginCredential.created_at"),
        encryptedSecret: String(row.encrypted_secret),
        id: asNumber(row.id),
        pluginId: String(row.plugin_id),
        updatedAt: asDate(row.updated_at, "UserPluginCredential.updated_at"),
        userId: asNumber(row.user_id),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `ClinicalDocumentWebhookEvent` ORDER BY `id`")) {
    await prisma.clinicalDocumentWebhookEvent.upsert({
      where: { id: asNumber(row.id) },
      create: {
        authorUserId: asNumber(row.author_user_id),
        clinicalNote: String(row.clinical_note),
        consumedAt: nullableDate(row.consumed_at),
        createdAt: asDate(row.created_at, "ClinicalDocumentWebhookEvent.created_at"),
        documentType: String(row.document_type),
        id: asNumber(row.id),
        patientId: asNumber(row.patient_id),
        payload: parseJson(row.payload),
        state: String(row.state),
        updatedAt: asDate(row.updated_at, "ClinicalDocumentWebhookEvent.updated_at"),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `AuditLog` ORDER BY `id`")) {
    await prisma.auditLog.upsert({
      where: { id: asNumber(row.id) },
      create: {
        action: String(row.action),
        category: String(row.category),
        createdAt: asDate(row.created_at, "AuditLog.created_at"),
        entityId: row.entity_id == null ? null : String(row.entity_id),
        entityType: row.entity_type == null ? null : String(row.entity_type),
        id: asNumber(row.id),
        metadata: parseJson(row.metadata),
        userId: asNullableNumber(row.user_id),
      },
      update: {},
    });
  }
}

async function migrateClinicalData(connection: mysql.Connection) {
  const soapRows = await queryRows(connection, "SELECT * FROM `SoapNote` ORDER BY `id`");
  for (const row of soapRows) {
    await createSoapComposition({
      appointmentId: asNullableNumber(row.appointment_id),
      assessment: String(row.assessment),
      authorUserId: asNumber(row.author_user_id),
      committedAt: asDate(row.updated_at, "SoapNote.updated_at"),
      encounteredAt: asDate(row.encountered_at, "SoapNote.encountered_at"),
      objective: String(row.objective),
      patientId: asNumber(row.patient_id),
      plan: String(row.plan),
      preserveAppointmentStatus: true,
      sourceMetadata: {
        v1: {
          createdAt: asDate(row.created_at, "SoapNote.created_at").toISOString(),
          entity: "SoapNote",
          id: asNumber(row.id),
          originalSourceRecordId:
            row.source_record_id == null ? null : String(row.source_record_id),
          originalSourceSystem:
            row.source_system == null ? null : String(row.source_system),
          updatedAt: asDate(row.updated_at, "SoapNote.updated_at").toISOString(),
        },
      },
      sourceRecordId: String(row.id),
      sourceSystem: V1_SOAP_SOURCE,
      subjective: String(row.subjective),
    });
  }

  const narrativeRows = await queryRows(
    connection,
    "SELECT * FROM `NarrativeNote` ORDER BY `id`",
  );
  for (const row of narrativeRows) {
    await createNarrativeComposition({
      authorUserId: asNumber(row.author_user_id),
      committedAt: asDate(row.updated_at, "NarrativeNote.updated_at"),
      encounteredAt: asDate(row.encountered_at, "NarrativeNote.encountered_at"),
      patientId: asNumber(row.patient_id),
      sections: narrativeSections(row.sections),
      sourceMetadata: {
        v1: {
          createdAt: asDate(row.created_at, "NarrativeNote.created_at").toISOString(),
          entity: "NarrativeNote",
          id: asNumber(row.id),
          originalSourceRecordId:
            row.source_record_id == null ? null : String(row.source_record_id),
          originalSourceSystem:
            row.source_system == null ? null : String(row.source_system),
          updatedAt: asDate(row.updated_at, "NarrativeNote.updated_at").toISOString(),
        },
      },
      sourceRecordId: String(row.id),
      sourceSystem: V1_NARRATIVE_SOURCE,
      title: row.title == null ? null : String(row.title),
    });
  }
}

async function copyAttachments(connection: mysql.Connection) {
  const soapVersions = await prisma.compositionVersion.findMany({
    where: { sourceSystem: V1_SOAP_SOURCE },
    select: { id: true, sourceRecordId: true },
  });
  const narrativeVersions = await prisma.compositionVersion.findMany({
    where: { sourceSystem: V1_NARRATIVE_SOURCE },
    select: { id: true, sourceRecordId: true },
  });
  const soapMap = new Map(soapVersions.map((item) => [item.sourceRecordId, item.id]));
  const narrativeMap = new Map(
    narrativeVersions.map((item) => [item.sourceRecordId, item.id]),
  );

  for (const row of await queryRows(connection, "SELECT * FROM `ClinicalAttachment` ORDER BY `id`")) {
    const compositionVersionId =
      row.soap_note_id != null
        ? soapMap.get(String(row.soap_note_id))
        : row.narrative_note_id != null
          ? narrativeMap.get(String(row.narrative_note_id))
          : undefined;
    if ((row.soap_note_id != null || row.narrative_note_id != null) && !compositionVersionId) {
      throw new Error(`ClinicalAttachment ${String(row.id)} could not resolve its composition.`);
    }
    await prisma.clinicalAttachment.upsert({
      where: { id: asNumber(row.id) },
      create: {
        appointmentId: asNullableNumber(row.appointment_id),
        authorUserId: asNumber(row.author_user_id),
        byteSize: asNumber(row.byte_size),
        compositionVersionId: compositionVersionId ?? null,
        contentType: String(row.content_type),
        createdAt: asDate(row.created_at, "ClinicalAttachment.created_at"),
        draftId: asNullableNumber(row.draft_id),
        fileName: String(row.file_name),
        id: asNumber(row.id),
        patientId: asNumber(row.patient_id),
        s3Bucket: String(row.s3_bucket),
        s3Key: String(row.s3_key),
        sha256: String(row.sha256),
        status: String(row.status),
        updatedAt: asDate(row.updated_at, "ClinicalAttachment.updated_at"),
      },
      update: {},
    });
  }
  for (const row of await queryRows(connection, "SELECT * FROM `AttachmentPluginExecution` ORDER BY `id`")) {
    await prisma.attachmentPluginExecution.upsert({
      where: { id: asNumber(row.id) },
      create: {
        attachmentId: asNumber(row.attachment_id),
        completedAt: nullableDate(row.completed_at),
        createdAt: asDate(row.created_at, "AttachmentPluginExecution.created_at"),
        error: row.error == null ? null : String(row.error),
        externalJobId: row.external_job_id == null ? null : String(row.external_job_id),
        id: asNumber(row.id),
        pluginId: String(row.plugin_id),
        requestedByUserId: asNumber(row.requested_by_user_id),
        result: parseJson(row.result),
        status: String(row.status),
        summary: row.summary == null ? null : String(row.summary),
        updatedAt: asDate(row.updated_at, "AttachmentPluginExecution.updated_at"),
      },
      update: {},
    });
  }
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonicalSqlValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  }
  if (Array.isArray(value)) {
    return value.map(canonicalSqlValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalSqlValue(item)]),
    );
  }
  return value;
}

function normalizedSqlRows(
  rows: Array<Record<string, unknown>>,
  jsonColumns: readonly string[],
  booleanColumns: readonly string[] = [],
) {
  return rows.map((row) => {
    const normalized = { ...row } as Record<string, unknown>;
    for (const column of jsonColumns) {
      if (typeof normalized[column] === "string") {
        normalized[column] = JSON.parse(normalized[column]);
      }
    }
    for (const column of booleanColumns) {
      normalized[column] = Boolean(normalized[column]);
    }
    return canonicalSqlValue(normalized);
  });
}

async function operationalDataDigests(
  sourceConnection: mysql.Connection,
  targetConnection: Client,
) {
  const commonAttachmentColumns = [
    "id",
    "patient_id",
    "author_user_id",
    "draft_id",
    "appointment_id",
    "status",
    "file_name",
    "content_type",
    "byte_size",
    "sha256",
    "s3_bucket",
    "s3_key",
    "created_at",
    "updated_at",
  ];
  const specs = [
    { table: "Patient", jsonColumns: [], booleanColumns: ["is_draft", "active"] },
    { table: "Contact", jsonColumns: [] },
    { table: "ContactPoint", jsonColumns: [] },
    { table: "Identifier", jsonColumns: [] },
    { table: "Appointment", jsonColumns: [] },
    {
      table: "GeneralSetting",
      jsonColumns: [],
      targetWhere:
        "WHERE \"property\" NOT IN ('migration.v1.startedAt', 'migration.v1.completedAt')",
    },
    { table: "AuthUser", jsonColumns: [], booleanColumns: ["is_active"] },
    { table: "AuthToken", jsonColumns: [], booleanColumns: ["is_active"] },
    { table: "EncounterDraft", jsonColumns: [] },
    {
      table: "ClinicalAttachment",
      columns: commonAttachmentColumns,
      jsonColumns: [],
    },
    { table: "AttachmentPluginExecution", jsonColumns: ["result"] },
    { table: "UserPluginCredential", jsonColumns: [] },
    { table: "ClinicalDocumentWebhookEvent", jsonColumns: ["payload"] },
  ] as const;
  const results: Record<string, { source: string; target: string }> = {};
  for (const spec of specs) {
    const columnNames = "columns" in spec ? spec.columns : null;
    const sourceColumns = columnNames
      ? columnNames.map((column) => `\`${column}\``).join(", ")
      : "*";
    const targetColumns = columnNames
      ? columnNames.map((column) => `\"${column}\"`).join(", ")
      : "*";
    const sourceRows = await queryRows(
      sourceConnection,
      `SELECT ${sourceColumns} FROM \`${spec.table}\` ORDER BY \`id\``,
    );
    const targetRows = await queryPostgreSqlRows(
      targetConnection,
      `SELECT ${targetColumns} FROM \"${spec.table}\" ${"targetWhere" in spec ? spec.targetWhere : ""} ORDER BY \"id\"`,
    );
    const booleanColumns =
      "booleanColumns" in spec ? spec.booleanColumns : [];
    results[spec.table] = {
      source: digest(normalizedSqlRows(sourceRows, spec.jsonColumns, booleanColumns)),
      target: digest(normalizedSqlRows(targetRows, spec.jsonColumns, booleanColumns)),
    };
  }

  const sourceAuditRows = await queryRows(
    sourceConnection,
    "SELECT * FROM `AuditLog` ORDER BY `id`",
  );
  const sourceAuditIds = sourceAuditRows.map((row) => asNumber(row.id));
  const targetAuditRows = sourceAuditIds.length
    ? await queryPostgreSqlRows(
        targetConnection,
        `SELECT * FROM \"AuditLog\" WHERE \"id\" = ANY($1::integer[]) ORDER BY \"id\"`,
        [sourceAuditIds],
      )
    : [];
  results.AuditLog = {
    source: digest(normalizedSqlRows(sourceAuditRows, ["metadata"])),
    target: digest(normalizedSqlRows(targetAuditRows, ["metadata"])),
  };
  return results;
}

async function clinicalSourceDigest(connection: mysql.Connection) {
  const soap = (await queryRows(connection, "SELECT * FROM `SoapNote` ORDER BY `id`"))
    .map((row) => ({
      appointmentId: asNullableNumber(row.appointment_id),
      authorUserId: asNumber(row.author_user_id),
      encounteredAt: asDate(row.encountered_at, "SoapNote.encountered_at").toISOString(),
      entity: "SoapNote",
      id: asNumber(row.id),
      patientId: asNumber(row.patient_id),
      sections: [
        { text: String(row.subjective), title: "Subjective" },
        { text: String(row.objective), title: "Objective" },
        { text: String(row.assessment), title: "Assessment" },
        { text: String(row.plan), title: "Plan" },
      ],
    }));
  const narrative = (
    await queryRows(connection, "SELECT * FROM `NarrativeNote` ORDER BY `id`")
  ).map((row) => ({
    appointmentId: null,
    authorUserId: asNumber(row.author_user_id),
    encounteredAt: asDate(row.encountered_at, "NarrativeNote.encountered_at").toISOString(),
    entity: "NarrativeNote",
    id: asNumber(row.id),
    patientId: asNumber(row.patient_id),
    sections: narrativeSections(row.sections).map(({ text, title }) => ({ text, title })),
  }));
  return digest(
    [...soap, ...narrative].sort((left, right) =>
      left.entity.localeCompare(right.entity) || left.id - right.id,
    ),
  );
}

function v1Identity(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const v1 = metadata.v1;
  if (!v1 || typeof v1 !== "object" || Array.isArray(v1)) {
    return null;
  }
  return {
    entity: String(v1.entity),
    id: Number(v1.id),
  };
}

async function clinicalTargetDigest() {
  const records = (await getClinicalCompositions())
    .flatMap((record) => {
      const identity = v1Identity(record.sourceMetadata);
      return identity
        ? [{
            appointmentId: record.appointmentId,
            authorUserId: record.author.id,
            encounteredAt: record.encounteredAt.toISOString(),
            entity: identity.entity,
            id: identity.id,
            patientId: record.patientId,
            sections: record.sections.map(({ text, title }) => ({ text, title })),
          }]
        : [];
    })
    .sort((left, right) =>
      left.entity.localeCompare(right.entity) || left.id - right.id,
    );
  return digest(records);
}

async function verifyMigration(
  sourceConnection: mysql.Connection,
  targetConnection: Client,
) {
  const source = await sourceCounts(sourceConnection);
  const target = await targetCounts();
  const checks = [
    ["Patient", source.Patient, target.Patient],
    ["Contact", source.Contact, target.Contact],
    ["ContactPoint", source.ContactPoint, target.ContactPoint],
    ["Identifier", source.Identifier, target.Identifier],
    ["Appointment", source.Appointment, target.Appointment],
    ["AuthUser", source.AuthUser, target.AuthUser],
    ["AuthToken", source.AuthToken, target.AuthToken],
    ["EncounterDraft", source.EncounterDraft, target.EncounterDraft],
    ["ClinicalAttachment", source.ClinicalAttachment, target.ClinicalAttachment],
    [
      "AttachmentPluginExecution",
      source.AttachmentPluginExecution,
      target.AttachmentPluginExecution,
    ],
    ["UserPluginCredential", source.UserPluginCredential, target.UserPluginCredential],
    [
      "ClinicalDocumentWebhookEvent",
      source.ClinicalDocumentWebhookEvent,
      target.ClinicalDocumentWebhookEvent,
    ],
    [
      "CompositionVersion",
      source.SoapNote + source.NarrativeNote,
      await prisma.compositionVersion.count({
        where: { sourceSystem: { in: [V1_SOAP_SOURCE, V1_NARRATIVE_SOURCE] } },
      }),
    ],
  ] as const;
  const mismatches: Array<readonly [string, number, number]> = checks.filter(
    ([, expected, actual]) => expected !== actual,
  );
  const sourceClinicalDigest = await clinicalSourceDigest(sourceConnection);
  const targetClinicalDigest = await clinicalTargetDigest();
  if (sourceClinicalDigest !== targetClinicalDigest) {
    mismatches.push(["ClinicalContentDigest", 1, 0]);
  }
  const unresolvedAttachments = await prisma.clinicalAttachment.count({
    where: {
      compositionVersionId: null,
      status: "attached",
    },
  });
  const sourceUnlinkedAttachments = Number(
    (
      await queryRows(
        sourceConnection,
        "SELECT COUNT(*) AS count FROM `ClinicalAttachment` WHERE `soap_note_id` IS NULL AND `narrative_note_id` IS NULL AND `status` = 'attached'",
      )
    )[0]?.count ?? 0,
  );
  if (unresolvedAttachments !== sourceUnlinkedAttachments) {
    mismatches.push([
      "AttachedCompositionLinks",
      source.ClinicalAttachment - sourceUnlinkedAttachments,
      source.ClinicalAttachment - unresolvedAttachments,
    ]);
  }
  const dataDigests = await operationalDataDigests(sourceConnection, targetConnection);
  for (const [table, tableDigests] of Object.entries(dataDigests)) {
    if (tableDigests.source !== tableDigests.target) {
      mismatches.push([`${table}DataDigest`, 1, 0]);
    }
  }

  const report = {
    checks: checks.map(([name, expected, actual]) => ({ actual, expected, name })),
    clinicalContentDigest: sourceClinicalDigest,
    mismatches: mismatches.map(([name, expected, actual]) => ({ actual, expected, name })),
    operationalDataDigests: dataDigests,
    result: mismatches.length ? "failed" : "verified",
    sourceDatabase: databaseName(requiredUrl("V1_DATABASE_URL")),
    targetDatabase: databaseName(requiredUrl("DATABASE_URL")),
  };
  if (mismatches.length) {
    throw new Error(`Migration verification failed:\n${JSON.stringify(report, null, 2)}`);
  }
  return report;
}

async function runMigration(
  sourceConnection: mysql.Connection,
  targetConnection: Client,
) {
  await assertTargetReadyForRun();
  await prisma.generalSetting.upsert({
    where: { property: "migration.v1.startedAt" },
    create: {
      id: MIGRATION_STARTED_ID,
      property: "migration.v1.startedAt",
      value: new Date().toISOString(),
    },
    update: {},
  });
  await copyOperationalData(sourceConnection);
  await resetPostgreSqlSequences(targetConnection);
  await migrateClinicalData(sourceConnection);
  await copyAttachments(sourceConnection);
  await resetPostgreSqlSequences(targetConnection);
  const report = await verifyMigration(sourceConnection, targetConnection);
  await prisma.generalSetting.upsert({
    where: { property: "migration.v1.completedAt" },
    create: {
      id: MIGRATION_COMPLETED_ID,
      property: "migration.v1.completedAt",
      value: new Date().toISOString(),
    },
    update: { value: new Date().toISOString() },
  });
  return report;
}

async function resetPostgreSqlSequences(connection: Client) {
  const tables = [
    "Patient",
    "Contact",
    "ContactPoint",
    "Identifier",
    "Appointment",
    "GeneralSetting",
    "AuthUser",
    "AuthToken",
    "EncounterDraft",
    "ClinicalAttachment",
    "AttachmentPluginExecution",
    "UserPluginCredential",
    "ClinicalDocumentWebhookEvent",
    "AuditLog",
  ] as const;
  for (const table of tables) {
    await connection.query(
      `SELECT setval(
         pg_get_serial_sequence('\"${table}\"', 'id'),
         GREATEST(COALESCE(MAX(\"id\"), 0), 1),
         MAX(\"id\") IS NOT NULL
       ) FROM \"${table}\"`,
    );
  }
}

async function main() {
  const command = process.argv[2] as MigrationCommand | undefined;
  if (!command || !["plan", "run", "verify"].includes(command)) {
    throw new Error("Usage: pnpm migrate:v1-to-v2 <plan|run|verify>");
  }
  const v1Url = requiredUrl("V1_DATABASE_URL");
  const v2Url = requiredUrl("DATABASE_URL");
  assertSeparateDatabases(v1Url, v2Url);
  // MySQL DATETIME has no timezone. Prisma persists it as UTC, so parsing the
  // V1 wall-clock values as UTC avoids shifting every historical timestamp by
  // the machine's local timezone during conversion.
  const sourceConnection = await mysql.createConnection({ uri: v1Url, timezone: "Z" });
  const targetConnection = new Client({ connectionString: v2Url });
  await targetConnection.connect();
  try {
    if (command === "plan") {
      console.log(
        JSON.stringify(
          {
            source: await sourceCounts(sourceConnection),
            sourceDatabase: databaseName(v1Url),
            target: await targetCounts(),
            targetDatabase: databaseName(v2Url),
          },
          null,
          2,
        ),
      );
      return;
    }
    const report =
      command === "run"
        ? await runMigration(sourceConnection, targetConnection)
        : await verifyMigration(sourceConnection, targetConnection);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sourceConnection.end();
    await targetConnection.end();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
