import { Prisma } from "@prisma/client";

import { normalizeNarrativeSections } from "~/lib/narrative-notes";
import { prisma } from "~/lib/prisma.server";
import { getOrCreateInstanceExportNamespace } from "~/lib/settings.server";
import { toFhirNarrativeDiv } from "~/lib/utils";

const patientExportQuery = Prisma.validator<Prisma.PatientDefaultArgs>()({
  include: {
    appointments: true,
    contacts: true,
    identifier: true,
    narrativeNotes: {
      include: {
        author: true,
      },
      orderBy: {
        encounteredAt: "asc",
      },
    },
    soapNotes: {
      include: {
        author: true,
      },
      orderBy: {
        encounteredAt: "asc",
      },
    },
    telecom: true,
  },
});

type ExportPatientRecord = Prisma.PatientGetPayload<typeof patientExportQuery>;

type ExportSummary = {
  appointments: number;
  narrativeNotes: number;
  patients: number;
  soapNotes: number;
};

type ExportBundle = {
  entry: Array<{
    resource: Record<string, unknown>;
  }>;
  resourceType: "Bundle";
  type: "transaction";
};

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function normalizeGender(value: string) {
  const normalized = value.toLowerCase();
  if (["female", "male", "other", "unknown"].includes(normalized)) {
    return normalized;
  }

  return "unknown";
}

function patientExportId(namespace: string, patientId: number) {
  return `exp-${namespace}-patient-${patientId}`;
}

function appointmentExportId(namespace: string, appointmentId: number) {
  return `exp-${namespace}-appointment-${appointmentId}`;
}

function soapExportId(namespace: string, noteId: number) {
  return `exp-${namespace}-soap-${noteId}`;
}

function narrativeExportId(namespace: string, noteId: number) {
  return `exp-${namespace}-narrative-${noteId}`;
}

function exportIdentifierSystem(namespace: string, resourceType: "patient" | "soap" | "narrative") {
  return `urn:fhir-soap-record:export:${namespace}:${resourceType}`;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function authorDisplay(author: { crm: string; crmUf: string; fullName: string }) {
  return `${author.fullName} CRM ${author.crm}/${author.crmUf}`;
}

function resolveSurvivorPatientId(
  patientId: number,
  patientsById: Map<number, Pick<ExportPatientRecord, "id" | "mergedIntoPatientId">>,
) {
  const visitedIds = new Set<number>();
  let currentPatientId = patientId;

  while (true) {
    if (visitedIds.has(currentPatientId)) {
      return currentPatientId;
    }

    visitedIds.add(currentPatientId);
    const current = patientsById.get(currentPatientId);
    if (!current?.mergedIntoPatientId) {
      return currentPatientId;
    }

    currentPatientId = current.mergedIntoPatientId;
  }
}

function bestBirthDate(members: ExportPatientRecord[], survivor: ExportPatientRecord) {
  return survivor.birthDate ?? members.find((patient) => patient.birthDate)?.birthDate ?? null;
}

function bestGender(members: ExportPatientRecord[], survivor: ExportPatientRecord) {
  if (survivor.gender !== "unknown") {
    return survivor.gender;
  }

  return members.find((patient) => patient.gender !== "unknown")?.gender ?? "unknown";
}

function buildExportPatientResource(
  namespace: string,
  survivor: ExportPatientRecord,
  members: ExportPatientRecord[],
) {
  const birthDate = bestBirthDate(members, survivor);
  const identifiers = uniqueBy(
    [
      {
        system: exportIdentifierSystem(namespace, "patient"),
        value: String(survivor.id),
      },
      ...members.flatMap((patient) =>
        patient.identifier.map((identifier) => ({
          system: identifier.system,
          value: identifier.value,
        })),
      ),
    ],
    (item) => `${item.system}::${item.value}`,
  );
  const telecom = uniqueBy(
    members.flatMap((patient) =>
      patient.telecom.map((contactPoint) => ({
        system: contactPoint.system,
        value: contactPoint.value,
      })),
    ),
    (item) => `${item.system}::${item.value}`,
  );
  const contacts = uniqueBy(
    members.flatMap((patient) =>
      patient.contacts.map((contact) => ({
        name: contact.name,
        relationship: contact.relationship,
      })),
    ),
    (item) => `${item.name}::${item.relationship}`,
  );

  return {
    resourceType: "Patient",
    id: patientExportId(namespace, survivor.id),
    active: true,
    identifier: identifiers,
    name: [{ text: survivor.name }],
    gender: normalizeGender(bestGender(members, survivor)),
    ...(birthDate
      ? {
          birthDate: formatDateOnly(birthDate),
        }
      : {
          extension: [
            {
              url: "https://fhir-soap-record.example/StructureDefinition/patient-draft",
              valueBoolean: true,
            },
          ],
        }),
    ...(telecom.length
      ? {
          telecom,
        }
      : {}),
    ...(contacts.length
      ? {
          contact: contacts.map((contact) => ({
            name: { text: contact.name },
            relationship: [{ text: contact.relationship }],
          })),
        }
      : {}),
  } satisfies Record<string, unknown>;
}

function buildExportAppointmentResource(
  namespace: string,
  patientResourceId: string,
  patientDisplayName: string,
  appointment: ExportPatientRecord["appointments"][number],
) {
  return {
    resourceType: "Appointment",
    id: appointmentExportId(namespace, appointment.id),
    status: appointment.status,
    start: appointment.start.toISOString(),
    end: appointment.end.toISOString(),
    appointmentType: {
      text: appointment.appointmentType,
    },
    participant: [
      {
        actor: {
          display: patientDisplayName,
          reference: `Patient/${patientResourceId}`,
        },
        status: "accepted",
      },
    ],
  } satisfies Record<string, unknown>;
}

function buildSoapCompositionResource(
  namespace: string,
  patientResourceId: string,
  patientDisplayName: string,
  note: ExportPatientRecord["soapNotes"][number],
) {
  return {
    resourceType: "Composition",
    id: soapExportId(namespace, note.id),
    identifier: [
      {
        system:
          note.sourceSystem?.trim() || exportIdentifierSystem(namespace, "soap"),
        value: note.sourceRecordId?.trim() || String(note.id),
      },
    ],
    status: "final",
    type: {
      text: "SOAP note",
    },
    title: `SOAP note for ${patientDisplayName}`,
    date: note.encounteredAt.toISOString(),
    subject: {
      display: patientDisplayName,
      reference: `Patient/${patientResourceId}`,
    },
    author: [
      {
        display: authorDisplay(note.author),
      },
    ],
    section: [
      {
        title: "Subjective",
        text: {
          div: toFhirNarrativeDiv(note.subjective),
          status: "generated",
        },
      },
      {
        title: "Objective",
        text: {
          div: toFhirNarrativeDiv(note.objective),
          status: "generated",
        },
      },
      {
        title: "Assessment",
        text: {
          div: toFhirNarrativeDiv(note.assessment),
          status: "generated",
        },
      },
      {
        title: "Plan",
        text: {
          div: toFhirNarrativeDiv(note.plan),
          status: "generated",
        },
      },
    ],
  } satisfies Record<string, unknown>;
}

function buildNarrativeCompositionResource(
  namespace: string,
  patientResourceId: string,
  patientDisplayName: string,
  note: ExportPatientRecord["narrativeNotes"][number],
) {
  const sections = normalizeNarrativeSections(note.sections);

  return {
    resourceType: "Composition",
    id: narrativeExportId(namespace, note.id),
    identifier: [
      {
        system:
          note.sourceSystem?.trim() || exportIdentifierSystem(namespace, "narrative"),
        value: note.sourceRecordId?.trim() || String(note.id),
      },
    ],
    status: "final",
    type: {
      text: "Consultation note",
    },
    title: note.title?.trim() || `Clinical note for ${patientDisplayName}`,
    date: note.encounteredAt.toISOString(),
    subject: {
      display: patientDisplayName,
      reference: `Patient/${patientResourceId}`,
    },
    author: [
      {
        display: authorDisplay(note.author),
      },
    ],
    section: sections.map((section, index) => ({
      ...(section.title ? { title: section.title } : { title: index === 0 ? "Narrative" : `Section ${index + 1}` }),
      text: {
        div: toFhirNarrativeDiv(section.text),
        status: "generated",
      },
    })),
  } satisfies Record<string, unknown>;
}

async function loadPatientsForExport() {
  return prisma.patient.findMany({
    ...patientExportQuery,
    orderBy: {
      id: "asc",
    },
  });
}

function groupPatientsForExport(patients: ExportPatientRecord[]) {
  const patientsById = new Map(
    patients.map((patient) => [
      patient.id,
      { id: patient.id, mergedIntoPatientId: patient.mergedIntoPatientId },
    ]),
  );
  const groups = new Map<number, ExportPatientRecord[]>();

  for (const patient of patients) {
    const survivorId = resolveSurvivorPatientId(patient.id, patientsById);
    if (!groups.has(survivorId)) {
      groups.set(survivorId, []);
    }
    groups.get(survivorId)?.push(patient);
  }

  return [...groups.entries()]
    .map(([survivorId, members]) => ({
      members,
      survivor: patients.find((patient) => patient.id === survivorId) ?? members[0],
    }))
    .sort((left, right) => left.survivor.id - right.survivor.id);
}

export async function getExportOverview() {
  const namespace = await getOrCreateInstanceExportNamespace();
  const [appointments, narrativeNotes, patients, soapNotes] = await Promise.all([
    prisma.appointment.count(),
    prisma.narrativeNote.count(),
    prisma.patient.count({
      where: {
        mergedIntoPatientId: null,
      },
    }),
    prisma.soapNote.count(),
  ]);

  return {
    counts: {
      appointments,
      narrativeNotes,
      patients,
      soapNotes,
    } satisfies ExportSummary,
    namespace,
  };
}

export async function buildFullInstanceExportBundle() {
  const namespace = await getOrCreateInstanceExportNamespace();
  const groups = groupPatientsForExport(await loadPatientsForExport());
  const entry: ExportBundle["entry"] = [];
  let appointments = 0;
  let narrativeNotes = 0;
  let soapNotes = 0;

  for (const group of groups) {
    const patientResourceId = patientExportId(namespace, group.survivor.id);
    entry.push({
      resource: buildExportPatientResource(namespace, group.survivor, group.members),
    });

    const mergedAppointments = group.members
      .flatMap((patient) => patient.appointments)
      .sort((left, right) => left.start.getTime() - right.start.getTime());
    for (const appointment of mergedAppointments) {
      entry.push({
        resource: buildExportAppointmentResource(
          namespace,
          patientResourceId,
          group.survivor.name,
          appointment,
        ),
      });
      appointments += 1;
    }

    const mergedSoapNotes = group.members
      .flatMap((patient) => patient.soapNotes)
      .sort((left, right) => {
        const encounteredAtDiff =
          left.encounteredAt.getTime() - right.encounteredAt.getTime();
        return encounteredAtDiff !== 0 ? encounteredAtDiff : left.id - right.id;
      });
    for (const note of mergedSoapNotes) {
      entry.push({
        resource: buildSoapCompositionResource(
          namespace,
          patientResourceId,
          group.survivor.name,
          note,
        ),
      });
      soapNotes += 1;
    }

    const mergedNarrativeNotes = group.members
      .flatMap((patient) => patient.narrativeNotes)
      .sort((left, right) => {
        const encounteredAtDiff =
          left.encounteredAt.getTime() - right.encounteredAt.getTime();
        return encounteredAtDiff !== 0 ? encounteredAtDiff : left.id - right.id;
      });
    for (const note of mergedNarrativeNotes) {
      entry.push({
        resource: buildNarrativeCompositionResource(
          namespace,
          patientResourceId,
          group.survivor.name,
          note,
        ),
      });
      narrativeNotes += 1;
    }
  }

  const dateStamp = new Date().toISOString().slice(0, 10);

  return {
    bundle: {
      entry,
      resourceType: "Bundle",
      type: "transaction",
    } satisfies ExportBundle,
    fileName: `fhir-soap-record-export-${namespace}-${dateStamp}.json`,
    summary: {
      appointments,
      narrativeNotes,
      patients: groups.length,
      soapNotes,
    } satisfies ExportSummary,
  };
}
