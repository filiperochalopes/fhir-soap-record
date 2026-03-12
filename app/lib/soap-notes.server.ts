import { Prisma, PrismaClient } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { prisma } from "~/lib/prisma.server";
import type { SoapNoteInput } from "~/lib/validation/soap";

type SoapClient = PrismaClient | Prisma.TransactionClient;

type SoapCreateInput = SoapNoteInput & {
  authorUserId: number;
  patientId: number;
  sourceRecordId?: string | null;
  sourceSystem?: string | null;
};

export async function createSoapNote(
  input: SoapCreateInput,
  db: SoapClient = prisma,
) {
  if (input.sourceSystem && input.sourceRecordId) {
    const existing = await db.soapNote.findFirst({
      where: {
        sourceRecordId: input.sourceRecordId,
        sourceSystem: input.sourceSystem,
      },
    });

    if (existing) {
      return null;
    }
  }

  const soapNote = await db.soapNote.create({
    data: {
      assessment: input.assessment,
      authorUserId: input.authorUserId,
      encounteredAt: input.encounteredAt,
      objective: input.objective,
      patientId: input.patientId,
      plan: input.plan,
      sourceRecordId: input.sourceRecordId ?? null,
      sourceSystem: input.sourceSystem ?? null,
      subjective: input.subjective,
    },
    include: {
      author: true,
      patient: true,
    },
  });

  await writeAuditLog(db, {
    action: input.sourceSystem ? "soap.import.created" : "soap.created",
    category: input.sourceSystem ? "import" : "soap",
    entityId: String(soapNote.id),
    entityType: "SoapNote",
    userId: input.authorUserId,
  });

  return soapNote;
}

export async function getPatientSoapNotes(patientId: number) {
  return prisma.soapNote.findMany({
    where: { patientId },
    include: {
      author: true,
    },
    orderBy: {
      encounteredAt: "asc",
    },
  });
}

export async function getSoapNoteById(noteId: number) {
  return prisma.soapNote.findUnique({
    where: { id: noteId },
    include: {
      author: true,
      patient: {
        include: {
          contacts: true,
          identifier: true,
          telecom: true,
        },
      },
    },
  });
}

export async function ensureImportUser() {
  return prisma.authUser.upsert({
    where: {
      crm_crmUf: {
        crm: "IMPORT",
        crmUf: "NA",
      },
    },
    create: {
      crm: "IMPORT",
      crmUf: "NA",
      fullName: "Imported Data",
    },
    update: {
      fullName: "Imported Data",
      isActive: true,
    },
  });
}

