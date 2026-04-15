import type { AuthUser, Contact, ContactPoint, Identifier, Patient, SoapNote } from "@prisma/client";

import {
  toSoapClinicalImpressionFhirId,
  toSoapCompositionFhirId,
  toSoapConditionFhirId,
  toSoapEncounterFhirId,
  toSoapObservationFhirId,
} from "~/lib/fhir/ids";
import { escapeHtml } from "~/lib/utils";

type SoapPatient = Patient & {
  contacts: Contact[];
  identifier: Identifier[];
  telecom: ContactPoint[];
};

export type SoapNoteWithRelations = SoapNote & {
  author: AuthUser;
  patient: SoapPatient;
};

function section(title: string, text: string, entries?: string[]) {
  return {
    title,
    ...(entries?.length
      ? {
          entry: entries.map((reference) => ({ reference })),
        }
      : {}),
    text: {
      div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escapeHtml(text)}</p></div>`,
      status: "generated",
    },
  };
}

export function toFhirEncounter(note: SoapNoteWithRelations) {
  return {
    resourceType: "Encounter",
    id: toSoapEncounterFhirId(note.id),
    status: "finished",
    subject: {
      display: note.patient.name,
      reference: `Patient/${note.patientId}`,
    },
    participant: [
      {
        individual: {
          display: `${note.author.fullName} CRM ${note.author.crm}/${note.author.crmUf}`,
        },
      },
    ],
    period: {
      start: note.encounteredAt.toISOString(),
      end: note.encounteredAt.toISOString(),
    },
    ...(note.appointmentId
      ? {
          appointment: [
            {
              reference: `Appointment/${note.appointmentId}`,
            },
          ],
        }
      : {}),
  };
}

export function toFhirObservation(note: SoapNoteWithRelations) {
  return {
    resourceType: "Observation",
    id: toSoapObservationFhirId(note.id),
    status: "final",
    code: {
      text: "SOAP Objective",
    },
    subject: {
      display: note.patient.name,
      reference: `Patient/${note.patientId}`,
    },
    encounter: {
      reference: `Encounter/${toSoapEncounterFhirId(note.id)}`,
    },
    effectiveDateTime: note.encounteredAt.toISOString(),
    valueString: note.objective,
  };
}

export function toFhirCondition(note: SoapNoteWithRelations) {
  return {
    resourceType: "Condition",
    id: toSoapConditionFhirId(note.id),
    clinicalStatus: {
      text: "active",
    },
    code: {
      text: note.assessment,
    },
    subject: {
      display: note.patient.name,
      reference: `Patient/${note.patientId}`,
    },
    encounter: {
      reference: `Encounter/${toSoapEncounterFhirId(note.id)}`,
    },
    recordedDate: note.encounteredAt.toISOString(),
  };
}

export function toFhirClinicalImpression(note: SoapNoteWithRelations) {
  return {
    resourceType: "ClinicalImpression",
    id: toSoapClinicalImpressionFhirId(note.id),
    status: "completed",
    subject: {
      display: note.patient.name,
      reference: `Patient/${note.patientId}`,
    },
    encounter: {
      reference: `Encounter/${toSoapEncounterFhirId(note.id)}`,
    },
    date: note.encounteredAt.toISOString(),
    summary: note.assessment,
    description: note.assessment,
  };
}

export function toFhirComposition(note: SoapNoteWithRelations) {
  return {
    resourceType: "Composition",
    id: toSoapCompositionFhirId(note.id),
    status: "final",
    type: {
      text: "SOAP note",
    },
    title: `SOAP note for ${note.patient.name}`,
    date: note.encounteredAt.toISOString(),
    subject: {
      display: note.patient.name,
      reference: `Patient/${note.patientId}`,
    },
    author: [
      {
        display: `${note.author.fullName} CRM ${note.author.crm}/${note.author.crmUf}`,
      },
    ],
    encounter: {
      reference: `Encounter/${toSoapEncounterFhirId(note.id)}`,
    },
    section: [
      section("Subjective", note.subjective),
      section("Objective", note.objective, [
        `Observation/${toSoapObservationFhirId(note.id)}`,
      ]),
      section("Assessment", note.assessment, [
        `ClinicalImpression/${toSoapClinicalImpressionFhirId(note.id)}`,
        `Condition/${toSoapConditionFhirId(note.id)}`,
      ]),
      section("Plan", note.plan),
    ],
  };
}
