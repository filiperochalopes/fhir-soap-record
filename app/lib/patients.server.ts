import { Prisma } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { prisma } from "~/lib/prisma.server";
import type { PatientInput } from "~/lib/validation/patients";

function patientNestedWrite(input: PatientInput) {
  return {
    birthDate: input.birthDate,
    contacts: {
      create: input.contacts.map((contact) => ({
        name: contact.name,
        relationship: contact.relationship,
      })),
    },
    gender: input.gender,
    isDraft: input.isDraft || !input.birthDate,
    identifier: {
      create: input.identifiers.map((identifier) => ({
        system: identifier.system,
        value: identifier.value,
      })),
    },
    name: input.name,
    telecom: {
      create: input.telecom.map((contactPoint) => ({
        system: contactPoint.system,
        value: contactPoint.value,
      })),
    },
  };
}

export async function savePatient(input: PatientInput, actorUserId: number, patientId?: number) {
  return prisma.$transaction(async (tx) => {
    const patient = patientId
      ? await tx.patient.update({
          where: { id: patientId },
          data: {
            birthDate: input.birthDate,
            contacts: {
              deleteMany: {},
              create: input.contacts,
            },
            gender: input.gender,
            isDraft: input.isDraft || !input.birthDate,
            identifier: {
              deleteMany: {},
              create: input.identifiers,
            },
            name: input.name,
            telecom: {
              deleteMany: {},
              create: input.telecom,
            },
          },
          include: {
            contacts: true,
            identifier: true,
            telecom: true,
          },
        })
      : await tx.patient.create({
          data: patientNestedWrite(input),
          include: {
            contacts: true,
            identifier: true,
            telecom: true,
          },
        });

    await writeAuditLog(tx, {
      action: patientId ? "patient.updated" : "patient.created",
      category: "patient",
      entityId: String(patient.id),
      entityType: "Patient",
      metadata: {
        name: patient.name,
      } satisfies Prisma.JsonObject,
      userId: actorUserId,
    });

    return patient;
  });
}

export async function findPatientForImport(args: {
  birthDate: Date | null;
  externalId?: string;
  identifiers: Array<{ system: string; value: string }>;
  isDraft: boolean;
  name: string;
  sourceSystem: string;
}) {
  if (args.externalId) {
    const externalIdentifier = await prisma.identifier.findUnique({
      where: {
        system_value: {
          system: `external:${args.sourceSystem}`,
          value: args.externalId,
        },
      },
      include: { patient: true },
    });

    if (externalIdentifier?.patient) {
      return externalIdentifier.patient;
    }
  }

  for (const identifier of args.identifiers) {
    const existing = await prisma.identifier.findUnique({
      where: {
        system_value: {
          system: identifier.system,
          value: identifier.value,
        },
      },
      include: { patient: true },
    });

    if (existing?.patient) {
      return existing.patient;
    }
  }

  return prisma.patient.findFirst({
    where: {
      birthDate: args.birthDate,
      ...(args.birthDate ? {} : { isDraft: args.isDraft }),
      name: args.name,
    },
    orderBy: [
      { isDraft: "asc" },
      { updatedAt: "desc" },
    ],
  });
}

export async function upsertImportedPatient(args: {
  actorUserId: number | null;
  input: Omit<PatientInput, "contacts" | "identifiers" | "telecom"> & {
    contacts: Array<{ name: string; relationship: string }>;
    externalId?: string;
    identifiers: Array<{ system: string; value: string }>;
    telecom: Array<{ system: string; value: string }>;
  };
  sourceSystem: string;
}) {
  const existing = await findPatientForImport({
    birthDate: args.input.birthDate,
    externalId: args.input.externalId,
    identifiers: args.input.identifiers,
    isDraft: args.input.isDraft || !args.input.birthDate,
    name: args.input.name,
    sourceSystem: args.sourceSystem,
  });

  const identifiers = [
    ...args.input.identifiers,
    ...(args.input.externalId
      ? [{ system: `external:${args.sourceSystem}`, value: args.input.externalId }]
      : []),
  ];

  if (!existing) {
    const created = await prisma.patient.create({
      data: {
        birthDate: args.input.birthDate,
        contacts: {
          create: args.input.contacts,
        },
        gender: args.input.gender,
        isDraft: args.input.isDraft || !args.input.birthDate,
        identifier: {
          create: identifiers,
        },
        name: args.input.name,
        telecom: {
          create: args.input.telecom,
        },
      },
      include: {
        contacts: true,
        identifier: true,
        telecom: true,
      },
    });

    await writeAuditLog(prisma, {
      action: "patient.import.created",
      category: "import",
      entityId: String(created.id),
      entityType: "Patient",
      userId: args.actorUserId,
    });

    return { patient: created, status: "created" as const };
  }

  const updated = await prisma.patient.update({
    where: { id: existing.id },
    data: {
      birthDate: args.input.birthDate ?? undefined,
      gender: args.input.gender,
      isDraft: args.input.birthDate ? args.input.isDraft : existing.isDraft,
      name: args.input.name,
      identifier: identifiers.length
        ? {
            createMany: {
              data: identifiers,
              skipDuplicates: true,
            },
          }
        : undefined,
      telecom: args.input.telecom.length
        ? {
            createMany: {
              data: args.input.telecom,
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    include: {
      contacts: true,
      identifier: true,
      telecom: true,
    },
  });

  await writeAuditLog(prisma, {
    action: "patient.import.updated",
    category: "import",
    entityId: String(updated.id),
    entityType: "Patient",
    userId: args.actorUserId,
  });

  return { patient: updated, status: "updated" as const };
}
