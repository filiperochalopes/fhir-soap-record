import type { AuthUser } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { createNarrativeNote } from "~/lib/narrative-notes.server";
import { prisma } from "~/lib/prisma.server";
import { upsertImportedPatient } from "~/lib/patients.server";
import { createSoapNote, ensureImportUser } from "~/lib/soap-notes.server";
import type { BundlePayload } from "~/lib/validation/import";
import { stripHtml } from "~/lib/utils";

type ImportSummary = {
  created: number;
  errors: Array<{ item: string; message: string }>;
  processed: number;
  skipped: number;
  updated: number;
};

function emptySummary(): ImportSummary {
  return {
    created: 0,
    errors: [],
    processed: 0,
    skipped: 0,
    updated: 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeGender(value: unknown): "female" | "male" | "other" | "unknown" {
  const gender = typeof value === "string" ? value.toLowerCase() : "unknown";
  return ["female", "male", "other", "unknown"].includes(gender)
    ? (gender as "female" | "male" | "other" | "unknown")
    : "unknown";
}

function primaryName(resource: Record<string, unknown>) {
  const name = Array.isArray(resource.name) ? resource.name[0] : undefined;
  const nameRecord = asRecord(name);

  if (!nameRecord) {
    return "";
  }

  if (typeof nameRecord.text === "string" && nameRecord.text.trim()) {
    return nameRecord.text.trim();
  }

  const given = Array.isArray(nameRecord.given)
    ? nameRecord.given.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const family = typeof nameRecord.family === "string" ? nameRecord.family : "";
  return [...given, family].join(" ").trim();
}

function parseIdentifierArray(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.identifier)) {
    return [];
  }

  return resource.identifier
    .flatMap((item) => {
      const record = asRecord(item);
      if (!record) {
        return [];
      }

      const system = typeof record.system === "string" ? record.system.trim() : "";
      const value = typeof record.value === "string" ? record.value.trim() : "";
      return system && value ? [{ system, value }] : [];
    })
    .slice(0, 10);
}

function parseTelecomArray(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.telecom)) {
    return [];
  }

  return resource.telecom.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const system = typeof record.system === "string" ? record.system.trim() : "";
    const value = typeof record.value === "string" ? record.value.trim() : "";
    return system && value ? [{ system, value }] : [];
  });
}

function parseContactArray(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.contact)) {
    return [];
  }

  return resource.contact.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const nameRecord = asRecord(record.name);
    const relationshipRecord =
      Array.isArray(record.relationship) && record.relationship[0]
        ? asRecord(record.relationship[0])
        : null;
    const name =
      nameRecord && typeof nameRecord.text === "string"
        ? nameRecord.text.trim()
        : "";
    const relationship =
      relationshipRecord && typeof relationshipRecord.text === "string"
        ? relationshipRecord.text.trim()
        : "";

    return name && relationship ? [{ name, relationship }] : [];
  });
}

function resourceByReference(
  resources: Map<string, Record<string, unknown>>,
  reference: string | undefined,
) {
  if (!reference) {
    return undefined;
  }

  return resources.get(reference);
}

function sectionText(
  resourceMap: Map<string, Record<string, unknown>>,
  sections: unknown[],
  title: string,
) {
  const match = sections.find((section) => {
    const record = asRecord(section);
    if (!record) {
      return false;
    }

    return typeof record.title === "string" && record.title.toLowerCase() === title;
  }) as Record<string, unknown> | undefined;

  if (!match) {
    return "";
  }

  const textRecord = asRecord(match.text);
  if (textRecord && typeof textRecord.div === "string") {
    return stripHtml(textRecord.div);
  }

  const entryRecord =
    Array.isArray(match.entry) && match.entry[0] ? asRecord(match.entry[0]) : null;

  if (!entryRecord) {
    return "";
  }

  const reference =
    typeof entryRecord.reference === "string" ? entryRecord.reference : undefined;
  const linkedResource = resourceByReference(resourceMap, reference);

  if (!linkedResource) {
    return "";
  }

  if (typeof linkedResource.valueString === "string") {
    return linkedResource.valueString;
  }

  if (typeof linkedResource.description === "string") {
    return linkedResource.description;
  }

  if (typeof linkedResource.summary === "string") {
    return linkedResource.summary;
  }

  const codeRecord = asRecord(linkedResource.code);
  if (codeRecord && typeof codeRecord.text === "string") {
    return codeRecord.text;
  }

  return "";
}

function appointmentPatientReference(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.participant)) {
    return undefined;
  }

  for (const participant of resource.participant) {
    const participantRecord = asRecord(participant);
    const actorRecord = asRecord(participantRecord?.actor);
    if (actorRecord && typeof actorRecord.reference === "string") {
      return actorRecord.reference;
    }
  }

  return undefined;
}

function appointmentTypeText(resource: Record<string, unknown>) {
  const appointmentType = asRecord(resource.appointmentType);
  if (!appointmentType) {
    return "";
  }

  if (typeof appointmentType.text === "string" && appointmentType.text.trim()) {
    return appointmentType.text.trim();
  }

  const firstCoding =
    Array.isArray(appointmentType.coding) && appointmentType.coding[0]
      ? asRecord(appointmentType.coding[0])
      : null;

  if (firstCoding && typeof firstCoding.display === "string" && firstCoding.display.trim()) {
    return firstCoding.display.trim();
  }

  if (firstCoding && typeof firstCoding.code === "string" && firstCoding.code.trim()) {
    return firstCoding.code.trim();
  }

  return "";
}

function sectionNarratives(
  resourceMap: Map<string, Record<string, unknown>>,
  sections: unknown[],
) {
  return sections.flatMap((section) => {
    const record = asRecord(section);
    if (!record) {
      return [];
    }

    const title = typeof record.title === "string" ? record.title.trim() : "";
    const textRecord = asRecord(record.text);
    if (textRecord && typeof textRecord.div === "string") {
      const text = stripHtml(textRecord.div);
      return text ? [{ text, title }] : [];
    }

    const entryRecord =
      Array.isArray(record.entry) && record.entry[0] ? asRecord(record.entry[0]) : null;
    if (!entryRecord || typeof entryRecord.reference !== "string") {
      return [];
    }

    const linkedResource = resourceByReference(resourceMap, entryRecord.reference);
    if (!linkedResource) {
      return [];
    }

    const text =
      typeof linkedResource.valueString === "string"
        ? linkedResource.valueString.trim()
        : typeof linkedResource.description === "string"
          ? linkedResource.description.trim()
          : typeof linkedResource.summary === "string"
            ? linkedResource.summary.trim()
            : "";

    return text ? [{ text, title }] : [];
  });
}

function compositionSource(
  resource: Record<string, unknown>,
  entryFullUrl: string | undefined,
) {
  const sourceRecordId =
    Array.isArray(resource.identifier) &&
    resource.identifier[0] &&
    typeof resource.identifier[0] === "object" &&
    typeof resource.identifier[0].value === "string"
      ? resource.identifier[0].value
      : typeof resource.id === "string"
        ? resource.id
        : entryFullUrl ?? `composition-${Date.now()}`;

  const sourceSystem =
    Array.isArray(resource.identifier) &&
    resource.identifier[0] &&
    typeof resource.identifier[0] === "object" &&
    typeof resource.identifier[0].system === "string"
      ? resource.identifier[0].system
      : "fhir-bundle";

  return { sourceRecordId, sourceSystem };
}

async function resolveReferencedPatient(
  reference: string | undefined,
  patientMap: Map<string, number>,
) {
  if (!reference) {
    return null;
  }

  if (patientMap.has(reference)) {
    return patientMap.get(reference) ?? null;
  }

  if (reference.startsWith("Patient/")) {
    const internalId = Number(reference.split("/")[1]);
    if (!Number.isNaN(internalId)) {
      const patient = await prisma.patient.findUnique({ where: { id: internalId } });
      return patient?.id ?? null;
    }
  }

  return null;
}

async function importAppointment(
  resource: Record<string, unknown>,
  patientId: number,
) {
  const start = typeof resource.start === "string" ? new Date(resource.start) : null;
  const end = typeof resource.end === "string" ? new Date(resource.end) : null;
  const status = typeof resource.status === "string" ? resource.status.trim() : "";
  const appointmentType = appointmentTypeText(resource);

  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    throw new Error("Appointment requires valid start and end");
  }

  if (!status) {
    throw new Error("Appointment requires status");
  }

  if (!appointmentType) {
    throw new Error("Appointment requires appointmentType.text, coding.display, or coding.code");
  }

  const existing = await prisma.appointment.findFirst({
    where: {
      end,
      patientId,
      start,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (!existing) {
    await prisma.appointment.create({
      data: {
        appointmentType,
        end,
        patientId,
        start,
        status,
      },
    });

    return "created" as const;
  }

  if (existing.status === status && existing.appointmentType === appointmentType) {
    return "skipped" as const;
  }

  await prisma.appointment.update({
    where: { id: existing.id },
    data: {
      appointmentType,
      status,
    },
  });

  return "updated" as const;
}

export async function importFhirBundle(payload: BundlePayload, actor: AuthUser) {
  const summary = emptySummary();
  const importUser = await ensureImportUser();
  const resourceMap = new Map<string, Record<string, unknown>>();
  const patientMap = new Map<string, number>();

  for (const entry of payload.entry) {
    const resource = entry.resource;
    if (typeof resource.resourceType !== "string") {
      continue;
    }

    if (entry.fullUrl) {
      resourceMap.set(entry.fullUrl, resource);
    }

    if (typeof resource.id === "string") {
      resourceMap.set(`${resource.resourceType}/${resource.id}`, resource);
    }
  }

  for (const entry of payload.entry) {
    const resource = entry.resource;
    if (resource.resourceType !== "Patient") {
      continue;
    }

    try {
      const name = primaryName(resource);
      const birthDate =
        typeof resource.birthDate === "string"
          ? new Date(`${resource.birthDate}T00:00:00.000Z`)
          : undefined;

      if (!name || !birthDate) {
        throw new Error("FHIR Patient requires name and birthDate for this MVP import");
      }

      summary.processed += 1;
      const patientResult = await upsertImportedPatient({
        actorUserId: actor.id,
        input: {
          birthDate,
          contacts: parseContactArray(resource),
          externalId: typeof resource.id === "string" ? resource.id : undefined,
          gender: normalizeGender(resource.gender),
          identifiers: parseIdentifierArray(resource),
          name,
          telecom: parseTelecomArray(resource),
        },
        sourceSystem: "fhir-bundle",
      });

      summary[patientResult.status] += 1;
      if (entry.fullUrl) {
        patientMap.set(entry.fullUrl, patientResult.patient.id);
      }
      if (typeof resource.id === "string") {
        patientMap.set(`Patient/${resource.id}`, patientResult.patient.id);
      }
    } catch (error) {
      summary.errors.push({
        item: "Patient",
        message: error instanceof Error ? error.message : "Unexpected patient import error",
      });
    }
  }

  for (const entry of payload.entry) {
    const resource = entry.resource;
    if (resource.resourceType !== "Appointment") {
      continue;
    }

    try {
      const patientId = await resolveReferencedPatient(
        appointmentPatientReference(resource),
        patientMap,
      );

      if (!patientId) {
        throw new Error("Appointment participant.actor.reference must resolve to a patient");
      }

      summary.processed += 1;
      const appointmentResult = await importAppointment(resource, patientId);
      summary[appointmentResult] += 1;
    } catch (error) {
      summary.errors.push({
        item: "Appointment",
        message:
          error instanceof Error ? error.message : "Unexpected appointment import error",
      });
    }
  }

  for (const entry of payload.entry) {
    const resource = entry.resource;
    if (resource.resourceType !== "Composition") {
      continue;
    }

    try {
      const patientId = await resolveReferencedPatient(
        asRecord(resource.subject) && typeof asRecord(resource.subject)?.reference === "string"
          ? (asRecord(resource.subject)?.reference as string)
          : undefined,
        patientMap,
      );

      if (!patientId) {
        throw new Error("Composition subject must resolve to a patient in this MVP");
      }

      const sections = Array.isArray(resource.section) ? resource.section : [];
      const encounterDate =
        typeof resource.date === "string"
          ? new Date(resource.date)
          : (() => {
              const encounterRef =
                asRecord(resource.encounter) &&
                typeof asRecord(resource.encounter)?.reference === "string"
                  ? (asRecord(resource.encounter)?.reference as string)
                  : undefined;
              const encounterResource = resourceByReference(resourceMap, encounterRef);
              const periodRecord = asRecord(encounterResource?.period);

              if (periodRecord && typeof periodRecord.start === "string") {
                return new Date(periodRecord.start);
              }

              return undefined;
            })();

      if (!encounterDate) {
        throw new Error("Composition requires date or Encounter.period.start");
      }

      const subjective = sectionText(resourceMap, sections, "subjective");
      const objective = sectionText(resourceMap, sections, "objective");
      const assessment = sectionText(resourceMap, sections, "assessment");
      const plan = sectionText(resourceMap, sections, "plan");
      const narrativeSections = sectionNarratives(resourceMap, sections);
      const { sourceRecordId, sourceSystem } = compositionSource(resource, entry.fullUrl);

      summary.processed += 1;
      const isSoapComposition = subjective && objective && assessment && plan;
      if (!isSoapComposition && !narrativeSections.length) {
        throw new Error(
          "Composition import requires either SOAP sections or at least one narrative section",
        );
      }

      const created = isSoapComposition
        ? await createSoapNote({
            assessment,
            authorUserId: importUser.id,
            encounteredAt: encounterDate,
            objective,
            patientId,
            plan,
            sourceRecordId,
            sourceSystem,
            subjective,
          })
        : await createNarrativeNote({
            authorUserId: importUser.id,
            encounteredAt: encounterDate,
            patientId,
            sections: narrativeSections,
            sourceRecordId,
            sourceSystem,
            title:
              typeof resource.title === "string" && resource.title.trim()
                ? resource.title.trim()
                : null,
          });

      if (created) {
        summary.created += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.errors.push({
        item: "Composition",
        message: error instanceof Error ? error.message : "Unexpected composition import error",
      });
    }
  }

  await writeAuditLog(prisma, {
    action: "import.fhir.executed",
    category: "import",
    entityType: "ImportJob",
    metadata: summary,
    userId: actor.id,
  });

  return summary;
}
