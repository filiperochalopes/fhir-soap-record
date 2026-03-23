import { Prisma, PrismaClient } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { normalizeNarrativeSections, serializeNarrativeSections, type NarrativeSection } from "~/lib/narrative-notes";
import { prisma } from "~/lib/prisma.server";

type NarrativeClient = PrismaClient | Prisma.TransactionClient;

type NarrativeCreateInput = {
  authorUserId: number;
  encounteredAt: Date;
  patientId: number;
  sections: NarrativeSection[];
  sourceRecordId?: string | null;
  sourceSystem?: string | null;
  title?: string | null;
};

export async function createNarrativeNote(
  input: NarrativeCreateInput,
  db: NarrativeClient = prisma,
) {
  const sections = serializeNarrativeSections(input.sections).filter((section) => section.text);
  if (!sections.length) {
    throw new Error("Narrative note requires at least one populated section");
  }

  if (input.sourceSystem && input.sourceRecordId) {
    const existing = await db.narrativeNote.findFirst({
      where: {
        sourceRecordId: input.sourceRecordId,
        sourceSystem: input.sourceSystem,
      },
    });

    if (existing) {
      return null;
    }
  }

  const narrativeNote = await db.narrativeNote.create({
    data: {
      authorUserId: input.authorUserId,
      encounteredAt: input.encounteredAt,
      patientId: input.patientId,
      sections: sections as Prisma.InputJsonValue,
      sourceRecordId: input.sourceRecordId ?? null,
      sourceSystem: input.sourceSystem ?? null,
      title: input.title?.trim() ? input.title.trim() : null,
    },
    include: {
      author: true,
      patient: true,
    },
  });

  await writeAuditLog(db, {
    action: input.sourceSystem ? "narrative.import.created" : "narrative.created",
    category: input.sourceSystem ? "import" : "narrative",
    entityId: String(narrativeNote.id),
    entityType: "NarrativeNote",
    userId: input.authorUserId,
  });

  return narrativeNote;
}

export async function getPatientNarrativeNotes(patientId: number) {
  return prisma.narrativeNote.findMany({
    where: { patientId },
    include: {
      author: true,
    },
    orderBy: {
      encounteredAt: "asc",
    },
  });
}

export async function getNarrativeNoteById(noteId: number) {
  return prisma.narrativeNote.findUnique({
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

export function noteSections(note: { sections: unknown }) {
  return normalizeNarrativeSections(note.sections);
}
