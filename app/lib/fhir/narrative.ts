import type {
  AuthUser,
  Contact,
  ContactPoint,
  Identifier,
  NarrativeNote,
  Patient,
} from "@prisma/client";

import { toNarrativeCompositionFhirId } from "~/lib/fhir/ids";
import { normalizeNarrativeSections } from "~/lib/narrative-notes";
import { toFhirNarrativeDiv } from "~/lib/utils";

type NarrativePatient = Patient & {
  contacts: Contact[];
  identifier: Identifier[];
  telecom: ContactPoint[];
};

export type NarrativeNoteWithRelations = NarrativeNote & {
  author: AuthUser;
  patient: NarrativePatient;
};

export function toFhirNarrativeComposition(note: NarrativeNoteWithRelations) {
  const sections = normalizeNarrativeSections(note.sections);

  return {
    resourceType: "Composition",
    id: toNarrativeCompositionFhirId(note.id),
    status: "final",
    type: {
      text: "Consultation note",
    },
    title: note.title?.trim() || `Clinical note for ${note.patient.name}`,
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
    section: sections.map((section, index) => ({
      ...(section.title ? { title: section.title } : { title: index === 0 ? "Narrative" : `Section ${index + 1}` }),
      text: {
        div: toFhirNarrativeDiv(section.text),
        status: "generated",
      },
    })),
  };
}
