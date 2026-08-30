import { z } from "zod";

const dvTextSchema = z.object({
  _type: z.literal("DV_TEXT"),
  value: z.string().min(1),
});

const elementSchema = z.object({
  _type: z.literal("ELEMENT"),
  archetype_node_id: z.string().min(1),
  name: dvTextSchema,
  value: dvTextSchema,
});

const itemTreeSchema = z.object({
  _type: z.literal("ITEM_TREE"),
  archetype_node_id: z.string().min(1),
  name: dvTextSchema,
  items: z.array(elementSchema).min(1),
});

const observationSchema = z.object({
  _type: z.literal("OBSERVATION"),
  archetype_node_id: z.string().min(1),
  name: dvTextSchema,
  data: z.object({
    _type: z.literal("HISTORY"),
    archetype_node_id: z.string().min(1),
    name: dvTextSchema,
    origin: z.string().datetime(),
    events: z
      .array(
        z.object({
          _type: z.literal("POINT_EVENT"),
          archetype_node_id: z.string().min(1),
          name: dvTextSchema,
          time: z.string().datetime(),
          data: itemTreeSchema,
        }),
      )
      .min(1),
  }),
});

const evaluationSchema = z.object({
  _type: z.literal("EVALUATION"),
  archetype_node_id: z.string().min(1),
  name: dvTextSchema,
  data: itemTreeSchema,
});

const entrySchema = z.discriminatedUnion("_type", [
  observationSchema,
  evaluationSchema,
]);

const sectionSchema = z.object({
  _type: z.literal("SECTION"),
  archetype_node_id: z.string().min(1),
  name: dvTextSchema,
  items: z.array(entrySchema).min(1),
});

export const compositionSchema = z.object({
  _type: z.literal("COMPOSITION"),
  archetype_node_id: z.string().min(1),
  name: dvTextSchema,
  language: z.object({
    code_string: z.string().min(1),
    terminology_id: z.literal("ISO_639-1"),
  }),
  territory: z.object({
    code_string: z.string().min(1),
    terminology_id: z.literal("ISO_3166-1"),
  }),
  category: z.object({
    code_string: z.literal("433"),
    terminology_id: z.literal("openehr"),
    value: z.literal("event"),
  }),
  composer: z.object({
    _type: z.literal("PARTY_IDENTIFIED"),
    external_ref: z.object({
      id: z.string().min(1),
      namespace: z.literal("soap-ehr"),
      type: z.literal("PERSON"),
    }),
    name: z.string().min(1),
  }),
  context: z.object({
    _type: z.literal("EVENT_CONTEXT"),
    start_time: z.string().datetime(),
    setting: z.object({
      code_string: z.literal("238"),
      terminology_id: z.literal("openehr"),
      value: z.literal("other care"),
    }),
  }),
  content: z.array(sectionSchema).min(1),
});

export type EhrComposition = z.infer<typeof compositionSchema>;

export function dvText(value: string) {
  return { _type: "DV_TEXT" as const, value };
}

export function narrativeItemTree(input: {
  elementNodeId: string;
  itemTreeNodeId: string;
  label: string;
  text: string;
}) {
  return {
    _type: "ITEM_TREE" as const,
    archetype_node_id: input.itemTreeNodeId,
    name: dvText(input.label),
    items: [
      {
        _type: "ELEMENT" as const,
        archetype_node_id: input.elementNodeId,
        name: dvText(input.label),
        value: dvText(input.text),
      },
    ],
  };
}

export function compositionNarrativeSections(composition: EhrComposition) {
  return composition.content.flatMap((section) =>
    section.items.flatMap((entry) => {
      const tree =
        entry._type === "OBSERVATION"
          ? entry.data.events[0]?.data
          : entry.data;
      const value = tree?.items[0]?.value.value;
      return value
        ? [{
            nodeId: section.archetype_node_id,
            text: value,
            title: section.name.value,
          }]
        : [];
    }),
  );
}
