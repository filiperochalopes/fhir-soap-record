import assert from "node:assert/strict";
import test from "node:test";

import { compositionNarrativeSections, compositionSchema } from "./rm";
import { buildNarrativeComposition } from "./templates/narrative";
import { buildSoapComposition, SOAP_NODE_IDS } from "./templates/soap";

const encounteredAt = new Date("2026-02-01T13:05:00.000Z");

test("SOAP operational template builds a valid four-section composition", () => {
  const composition = buildSoapComposition({
    assessment: "Assessment text",
    authorId: 7,
    authorName: "Dra. Teste",
    encounteredAt,
    objective: "Objective text",
    patientName: "Patient Test",
    plan: "Plan text",
    subjective: "Subjective text",
  });

  assert.doesNotThrow(() => compositionSchema.parse(composition));
  const sections = compositionNarrativeSections(composition);
  assert.deepEqual(
    sections.map(({ nodeId, text }) => ({ nodeId, text })),
    [
      { nodeId: SOAP_NODE_IDS.subjective, text: "Subjective text" },
      { nodeId: SOAP_NODE_IDS.objective, text: "Objective text" },
      { nodeId: SOAP_NODE_IDS.assessment, text: "Assessment text" },
      { nodeId: SOAP_NODE_IDS.plan, text: "Plan text" },
    ],
  );
});

test("SOAP operational template preserves empty legacy section values", () => {
  const composition = buildSoapComposition({
    assessment: "",
    authorId: 7,
    authorName: "Dra. Teste",
    encounteredAt,
    objective: "Objective text",
    patientName: "Patient Test",
    plan: "",
    subjective: "",
  });

  assert.doesNotThrow(() => compositionSchema.parse(composition));
  assert.deepEqual(
    compositionNarrativeSections(composition).map(({ nodeId, text }) => ({ nodeId, text })),
    [
      { nodeId: SOAP_NODE_IDS.subjective, text: "" },
      { nodeId: SOAP_NODE_IDS.objective, text: "Objective text" },
      { nodeId: SOAP_NODE_IDS.assessment, text: "" },
      { nodeId: SOAP_NODE_IDS.plan, text: "" },
    ],
  );
});

test("narrative template preserves section order and text", () => {
  const composition = buildNarrativeComposition({
    authorId: 7,
    authorName: "Dra. Teste",
    encounteredAt,
    patientName: "Patient Test",
    sections: [
      { title: "History", text: "First" },
      { title: "Discussion", text: "Second" },
    ],
    title: "Narrative consultation",
  });

  assert.deepEqual(
    compositionNarrativeSections(composition).map(({ title, text }) => ({ title, text })),
    [
      { title: "History", text: "First" },
      { title: "Discussion", text: "Second" },
    ],
  );
});
