import { compositionSchema, dvText, narrativeItemTree, type EhrComposition } from "~/lib/ehr/rm";

export const SOAP_TEMPLATE_ID = "soap-ehr.template.encounter-soap.v1";
export const ENCOUNTER_ARCHETYPE_ID = "openEHR-EHR-COMPOSITION.encounter.v1";

export const SOAP_NODE_IDS = {
  assessment: "at0003",
  objective: "at0002",
  plan: "at0004",
  subjective: "at0001",
} as const;

export const SOAP_OPERATIONAL_TEMPLATE = {
  id: SOAP_TEMPLATE_ID,
  name: "Consulta SOAP",
  version: "1.0.0",
  rootArchetypeId: ENCOUNTER_ARCHETYPE_ID,
  sections: [
    {
      id: SOAP_NODE_IDS.subjective,
      name: "Subjective",
      entryArchetypeId: "openEHR-EHR-OBSERVATION.story.v1",
      rmType: "OBSERVATION",
      required: true,
    },
    {
      id: SOAP_NODE_IDS.objective,
      name: "Objective",
      entryArchetypeId: "openEHR-EHR-OBSERVATION.clinical_exam.v1",
      rmType: "OBSERVATION",
      required: true,
    },
    {
      id: SOAP_NODE_IDS.assessment,
      name: "Assessment",
      entryArchetypeId: "openEHR-EHR-EVALUATION.clinical_assessment.v1",
      rmType: "EVALUATION",
      required: true,
    },
    {
      id: SOAP_NODE_IDS.plan,
      name: "Plan",
      entryArchetypeId: "openEHR-EHR-EVALUATION.care_plan.v1",
      rmType: "EVALUATION",
      required: true,
    },
  ],
} as const;

type SoapCompositionInput = {
  assessment: string;
  authorId: number;
  authorName: string;
  encounteredAt: Date;
  objective: string;
  patientName: string;
  plan: string;
  subjective: string;
};

function observationSection(input: {
  entryArchetypeId: string;
  nodeId: string;
  text: string;
  title: string;
  time: string;
}) {
  return {
    _type: "SECTION" as const,
    archetype_node_id: input.nodeId,
    name: dvText(input.title),
    items: [
      {
        _type: "OBSERVATION" as const,
        archetype_node_id: input.entryArchetypeId,
        name: dvText(input.title),
        data: {
          _type: "HISTORY" as const,
          archetype_node_id: "at0001",
          name: dvText(`${input.title} history`),
          origin: input.time,
          events: [
            {
              _type: "POINT_EVENT" as const,
              archetype_node_id: "at0002",
              name: dvText(input.title),
              time: input.time,
              data: narrativeItemTree({
                elementNodeId: "at0004",
                itemTreeNodeId: "at0003",
                label: input.title,
                text: input.text,
              }),
            },
          ],
        },
      },
    ],
  };
}

function evaluationSection(input: {
  entryArchetypeId: string;
  nodeId: string;
  text: string;
  title: string;
}) {
  return {
    _type: "SECTION" as const,
    archetype_node_id: input.nodeId,
    name: dvText(input.title),
    items: [
      {
        _type: "EVALUATION" as const,
        archetype_node_id: input.entryArchetypeId,
        name: dvText(input.title),
        data: narrativeItemTree({
          elementNodeId: "at0002",
          itemTreeNodeId: "at0001",
          label: input.title,
          text: input.text,
        }),
      },
    ],
  };
}

export function buildSoapComposition(input: SoapCompositionInput): EhrComposition {
  const time = input.encounteredAt.toISOString();
  const composition = {
    _type: "COMPOSITION" as const,
    archetype_node_id: ENCOUNTER_ARCHETYPE_ID,
    name: dvText(`Consulta SOAP de ${input.patientName}`),
    language: { code_string: "pt", terminology_id: "ISO_639-1" as const },
    territory: { code_string: "BR", terminology_id: "ISO_3166-1" as const },
    category: {
      code_string: "433" as const,
      terminology_id: "openehr" as const,
      value: "event" as const,
    },
    composer: {
      _type: "PARTY_IDENTIFIED" as const,
      external_ref: {
        id: String(input.authorId),
        namespace: "soap-ehr" as const,
        type: "PERSON" as const,
      },
      name: input.authorName,
    },
    context: {
      _type: "EVENT_CONTEXT" as const,
      start_time: time,
      setting: {
        code_string: "238" as const,
        terminology_id: "openehr" as const,
        value: "other care" as const,
      },
    },
    content: [
      observationSection({
        entryArchetypeId: SOAP_OPERATIONAL_TEMPLATE.sections[0].entryArchetypeId,
        nodeId: SOAP_NODE_IDS.subjective,
        text: input.subjective,
        time,
        title: "Subjective",
      }),
      observationSection({
        entryArchetypeId: SOAP_OPERATIONAL_TEMPLATE.sections[1].entryArchetypeId,
        nodeId: SOAP_NODE_IDS.objective,
        text: input.objective,
        time,
        title: "Objective",
      }),
      evaluationSection({
        entryArchetypeId: SOAP_OPERATIONAL_TEMPLATE.sections[2].entryArchetypeId,
        nodeId: SOAP_NODE_IDS.assessment,
        text: input.assessment,
        title: "Assessment",
      }),
      evaluationSection({
        entryArchetypeId: SOAP_OPERATIONAL_TEMPLATE.sections[3].entryArchetypeId,
        nodeId: SOAP_NODE_IDS.plan,
        text: input.plan,
        title: "Plan",
      }),
    ],
  };

  return compositionSchema.parse(composition);
}
