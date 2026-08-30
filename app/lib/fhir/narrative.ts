import type { ClinicalCompositionRecord } from "~/lib/ehr/compositions.server";

import { toNarrativeCompositionFhirId } from "~/lib/fhir/ids";
import { toFhirNarrativeDiv } from "~/lib/utils";

export function toFhirNarrativeComposition(note: ClinicalCompositionRecord) {
  const sections = note.sections;

  return {
    resourceType: "Composition",
    id: note.fhirCompositionId || toNarrativeCompositionFhirId(note.id),
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
