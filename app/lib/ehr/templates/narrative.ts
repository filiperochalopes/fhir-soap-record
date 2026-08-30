import { compositionSchema, dvText, narrativeItemTree, type EhrComposition } from "~/lib/ehr/rm";
import { ENCOUNTER_ARCHETYPE_ID } from "~/lib/ehr/templates/soap";
import type { NarrativeSection } from "~/lib/narrative-notes";

export const NARRATIVE_TEMPLATE_ID = "soap-ehr.template.encounter-narrative.v1";

export const NARRATIVE_OPERATIONAL_TEMPLATE = {
  id: NARRATIVE_TEMPLATE_ID,
  name: "Nota clínica narrativa",
  version: "1.0.0",
  rootArchetypeId: ENCOUNTER_ARCHETYPE_ID,
  repeatingSection: {
    entryArchetypeId: "openEHR-EHR-EVALUATION.clinical_narrative.v1",
    rmType: "EVALUATION",
    required: true,
  },
} as const;

export function buildNarrativeComposition(input: {
  authorId: number;
  authorName: string;
  encounteredAt: Date;
  patientName: string;
  sections: NarrativeSection[];
  title: string;
}): EhrComposition {
  const time = input.encounteredAt.toISOString();
  return compositionSchema.parse({
    _type: "COMPOSITION",
    archetype_node_id: ENCOUNTER_ARCHETYPE_ID,
    name: dvText(input.title),
    language: { code_string: "pt", terminology_id: "ISO_639-1" },
    territory: { code_string: "BR", terminology_id: "ISO_3166-1" },
    category: { code_string: "433", terminology_id: "openehr", value: "event" },
    composer: {
      _type: "PARTY_IDENTIFIED",
      external_ref: {
        id: String(input.authorId),
        namespace: "soap-ehr",
        type: "PERSON",
      },
      name: input.authorName,
    },
    context: {
      _type: "EVENT_CONTEXT",
      start_time: time,
      setting: {
        code_string: "238",
        terminology_id: "openehr",
        value: "other care",
      },
    },
    content: input.sections.map((section, index) => ({
      _type: "SECTION",
      archetype_node_id: `at${String(index + 1).padStart(4, "0")}`,
      name: dvText(section.title || (index === 0 ? "Narrative" : `Section ${index + 1}`)),
      items: [
        {
          _type: "EVALUATION",
          archetype_node_id:
            NARRATIVE_OPERATIONAL_TEMPLATE.repeatingSection.entryArchetypeId,
          name: dvText(section.title || "Clinical narrative"),
          data: narrativeItemTree({
            elementNodeId: "at0002",
            itemTreeNodeId: "at0001",
            label: section.title || "Narrative",
            text: section.text,
          }),
        },
      ],
    })),
  });
}
