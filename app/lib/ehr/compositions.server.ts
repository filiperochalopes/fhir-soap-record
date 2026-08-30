import { createHash, randomUUID } from "node:crypto";

import type { AuthUser, Prisma, PrismaClient } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { promoteDraftAttachments } from "~/lib/attachments.server";
import { compositionNarrativeSections, compositionSchema, type EhrComposition } from "~/lib/ehr/rm";
import { ensureClinicalKnowledge } from "~/lib/ehr/knowledge.server";
import {
  buildNarrativeComposition,
  NARRATIVE_TEMPLATE_ID,
} from "~/lib/ehr/templates/narrative";
import {
  buildSoapComposition,
  ENCOUNTER_ARCHETYPE_ID,
  SOAP_NODE_IDS,
  SOAP_TEMPLATE_ID,
} from "~/lib/ehr/templates/soap";
import { normalizeNarrativeSections, type NarrativeSection } from "~/lib/narrative-notes";
import { prisma } from "~/lib/prisma.server";
import type { SoapNoteInput } from "~/lib/validation/soap";

type EhrClient = PrismaClient | Prisma.TransactionClient;

type SoapCompositionCreateInput = SoapNoteInput & {
  appointmentId?: number | null;
  authorUserId: number;
  attachmentDraftKey?: string | null;
  committedAt?: Date;
  patientId: number;
  preserveAppointmentStatus?: boolean;
  sourceRecordId?: string | null;
  sourceMetadata?: Prisma.InputJsonValue;
  sourceSystem?: string | null;
};

type NarrativeCompositionCreateInput = {
  authorUserId: number;
  attachmentDraftKey?: string | null;
  committedAt?: Date;
  encounteredAt: Date;
  patientId: number;
  sections: NarrativeSection[];
  sourceRecordId?: string | null;
  sourceMetadata?: Prisma.InputJsonValue;
  sourceSystem?: string | null;
  title?: string | null;
};

const compositionInclude = {
  composer: true,
  versionedComposition: {
    include: {
      ehr: {
        include: {
          patient: {
            include: {
              contacts: true,
              identifier: true,
              telecom: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CompositionVersionInclude;

export type CompositionVersionWithRelations = Prisma.CompositionVersionGetPayload<{
  include: typeof compositionInclude;
}>;

export type ClinicalCompositionRecord = {
  appointmentId: number | null;
  assessment: string | null;
  author: AuthUser;
  content: EhrComposition;
  encounteredAt: Date;
  fhirCompositionId: string;
  id: string;
  kind: "narrative" | "soap";
  objective: string | null;
  patient: CompositionVersionWithRelations["versionedComposition"]["ehr"]["patient"];
  patientId: number;
  plan: string | null;
  sections: Array<{ nodeId: string; text: string; title: string }>;
  sourceRecordId: string | null;
  sourceMetadata: Prisma.JsonValue | null;
  sourceSystem: string | null;
  subjective: string | null;
  templateId: string;
  title: string;
};

function contentHash(content: EhrComposition) {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function sectionByNodeId(
  sections: ClinicalCompositionRecord["sections"],
  nodeId: string,
) {
  return sections.find((section) => section.nodeId === nodeId)?.text ?? null;
}

export function toClinicalCompositionRecord(
  version: CompositionVersionWithRelations,
): ClinicalCompositionRecord {
  const content = compositionSchema.parse(version.content);
  const sections = compositionNarrativeSections(content);
  const kind = version.templateId === SOAP_TEMPLATE_ID ? "soap" : "narrative";

  return {
    appointmentId: version.appointmentId,
    assessment:
      kind === "soap" ? sectionByNodeId(sections, SOAP_NODE_IDS.assessment) : null,
    author: version.composer,
    content,
    encounteredAt: version.encounteredAt,
    fhirCompositionId: version.fhirCompositionId,
    id: version.id,
    kind,
    objective:
      kind === "soap" ? sectionByNodeId(sections, SOAP_NODE_IDS.objective) : null,
    patient: version.versionedComposition.ehr.patient,
    patientId: version.versionedComposition.ehr.patientId,
    plan: kind === "soap" ? sectionByNodeId(sections, SOAP_NODE_IDS.plan) : null,
    sections,
    sourceRecordId: version.sourceRecordId,
    sourceMetadata: version.sourceMetadata,
    sourceSystem: version.sourceSystem,
    subjective:
      kind === "soap" ? sectionByNodeId(sections, SOAP_NODE_IDS.subjective) : null,
    templateId: version.templateId,
    title: version.title,
  };
}

async function createCompositionVersion(
  input: {
    appointmentId?: number | null;
    attachmentDraftKey?: string | null;
    authorUserId: number;
    content: EhrComposition;
    committedAt?: Date;
    encounteredAt: Date;
    kind: "narrative" | "soap";
    patientId: number;
    preserveAppointmentStatus?: boolean;
    sourceRecordId?: string | null;
    sourceMetadata?: Prisma.InputJsonValue;
    sourceSystem?: string | null;
    templateId: string;
    title: string;
  },
  db: EhrClient,
) {
  if (input.sourceSystem && input.sourceRecordId) {
    const existing = await db.compositionVersion.findFirst({
      where: {
        sourceRecordId: input.sourceRecordId,
        sourceSystem: input.sourceSystem,
      },
    });
    if (existing) {
      return null;
    }
  }

  const [patient, author] = await Promise.all([
    db.patient.findUnique({ where: { id: input.patientId }, select: { id: true } }),
    db.authUser.findUnique({ where: { id: input.authorUserId }, select: { id: true } }),
  ]);
  if (!patient) {
    throw new Error("Patient not found.");
  }
  if (!author) {
    throw new Error("Composer not found.");
  }

  const linkedAppointment = input.appointmentId
    ? await db.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { id: true, patientId: true, status: true },
      })
    : null;
  if (input.appointmentId && !linkedAppointment) {
    throw new Error("Appointment not found.");
  }
  if (linkedAppointment && linkedAppointment.patientId !== input.patientId) {
    throw new Error("Appointment does not belong to this patient.");
  }

  await ensureClinicalKnowledge(db);
  const ehr = await db.ehrRecord.upsert({
    where: { patientId: input.patientId },
    create: { patientId: input.patientId },
    update: {},
  });
  const versionedCompositionId = randomUUID();
  const versionId = randomUUID();
  const committedAt = input.committedAt ?? new Date();
  const contribution = await db.contribution.create({
    data: {
      changeType: "creation",
      committerUserId: input.authorUserId,
      description: `Create ${input.kind} clinical composition`,
      ehrId: ehr.id,
      committedAt,
    },
  });
  await db.versionedComposition.create({
    data: { createdAt: committedAt, ehrId: ehr.id, id: versionedCompositionId },
  });
  const version = await db.compositionVersion.create({
    data: {
      appointmentId: input.appointmentId ?? null,
      archetypeId: ENCOUNTER_ARCHETYPE_ID,
      committedAt,
      composerUserId: input.authorUserId,
      content: input.content as Prisma.InputJsonValue,
      contentHash: contentHash(input.content),
      contributionId: contribution.id,
      encounteredAt: input.encounteredAt,
      fhirCompositionId: `${input.kind}-note-${versionId}`,
      id: versionId,
      sourceRecordId: input.sourceRecordId ?? null,
      sourceMetadata: input.sourceMetadata,
      sourceSystem: input.sourceSystem ?? null,
      templateId: input.templateId,
      title: input.title,
      versionedCompositionId,
    },
    include: compositionInclude,
  });

  if (
    linkedAppointment &&
    !input.preserveAppointmentStatus &&
    linkedAppointment.status !== "fulfilled"
  ) {
    await db.appointment.update({
      where: { id: linkedAppointment.id },
      data: { status: "fulfilled" },
    });
  }

  await writeAuditLog(db, {
    action: input.sourceSystem ? "composition.import.created" : "composition.created",
    category: "ehr",
    entityId: version.id,
    entityType: "CompositionVersion",
    metadata: {
      contributionId: contribution.id,
      templateId: input.templateId,
      versionedCompositionId,
      ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
    } satisfies Prisma.JsonObject,
    userId: input.authorUserId,
  });

  await promoteDraftAttachments(
    {
      appointmentId: input.appointmentId ?? null,
      authorUserId: input.authorUserId,
      compositionVersionId: version.id,
      draftKey: input.attachmentDraftKey,
      patientId: input.patientId,
    },
    db,
  );

  return toClinicalCompositionRecord(version);
}

export async function createSoapComposition(
  input: SoapCompositionCreateInput,
  db: EhrClient = prisma,
): Promise<ClinicalCompositionRecord | null> {
  if (db === prisma) {
    return prisma.$transaction((tx) => createSoapComposition(input, tx));
  }

  const [patient, author] = await Promise.all([
    db.patient.findUnique({ where: { id: input.patientId }, select: { name: true } }),
    db.authUser.findUnique({ where: { id: input.authorUserId }, select: { fullName: true } }),
  ]);
  if (!patient || !author) {
    throw new Error("Patient or composer not found.");
  }
  const content = buildSoapComposition({
    ...input,
    authorId: input.authorUserId,
    authorName: author.fullName,
    patientName: patient.name,
  });
  return createCompositionVersion(
    {
      ...input,
      content,
      kind: "soap",
      templateId: SOAP_TEMPLATE_ID,
      title: `SOAP note for ${patient.name}`,
    },
    db,
  );
}

export async function createNarrativeComposition(
  input: NarrativeCompositionCreateInput,
  db: EhrClient = prisma,
): Promise<ClinicalCompositionRecord | null> {
  if (db === prisma) {
    return prisma.$transaction((tx) => createNarrativeComposition(input, tx));
  }

  const sections = input.sections.filter((section) => section.text.length > 0);
  if (!sections.length) {
    throw new Error("Narrative note requires at least one populated section.");
  }
  const [patient, author] = await Promise.all([
    db.patient.findUnique({ where: { id: input.patientId }, select: { name: true } }),
    db.authUser.findUnique({ where: { id: input.authorUserId }, select: { fullName: true } }),
  ]);
  if (!patient || !author) {
    throw new Error("Patient or composer not found.");
  }
  const title = input.title?.trim() || `Clinical note for ${patient.name}`;
  const content = buildNarrativeComposition({
    authorId: input.authorUserId,
    authorName: author.fullName,
    encounteredAt: input.encounteredAt,
    patientName: patient.name,
    sections,
    title,
  });
  return createCompositionVersion(
    {
      ...input,
      content,
      kind: "narrative",
      templateId: NARRATIVE_TEMPLATE_ID,
      title,
    },
    db,
  );
}

export async function getClinicalCompositions(patientId?: number) {
  const versions = await prisma.compositionVersion.findMany({
    where: {
      followingVersions: { none: {} },
      ...(patientId
        ? { versionedComposition: { ehr: { patientId } } }
        : {}),
    },
    include: compositionInclude,
    orderBy: { encounteredAt: "asc" },
  });
  return versions.map(toClinicalCompositionRecord);
}

export function getPatientClinicalCompositions(patientId: number) {
  return getClinicalCompositions(patientId);
}

export async function getCompositionByVersionId(versionId: string) {
  const version = await prisma.compositionVersion.findUnique({
    where: { id: versionId },
    include: compositionInclude,
  });
  return version ? toClinicalCompositionRecord(version) : null;
}

export async function getCompositionByFhirId(fhirCompositionId: string) {
  const version = await prisma.compositionVersion.findUnique({
    where: { fhirCompositionId },
    include: compositionInclude,
  });
  return version ? toClinicalCompositionRecord(version) : null;
}

export async function ensureImportUser() {
  return prisma.authUser.upsert({
    where: { crm_crmUf: { crm: "IMPORT", crmUf: "NA" } },
    create: { crm: "IMPORT", crmUf: "NA", fullName: "Imported Data" },
    update: { fullName: "Imported Data", isActive: true },
  });
}

export function narrativeSections(record: ClinicalCompositionRecord) {
  return normalizeNarrativeSections(record.sections);
}
