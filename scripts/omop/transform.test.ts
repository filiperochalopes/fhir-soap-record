import assert from "node:assert/strict";
import test from "node:test";

import { buildSoapComposition } from "../../app/lib/ehr/templates/soap";
import {
  compositionNoteText,
  genderConceptId,
  resolveCanonicalPatientIds,
  truncateSourceValue,
} from "./transform";

test("maps the supported gender source values and preserves unknown as concept 0", () => {
  assert.equal(genderConceptId("female"), 8532);
  assert.equal(genderConceptId("MALE"), 8507);
  assert.equal(genderConceptId("unknown"), 0);
});

test("resolves transitive patient merges", () => {
  const resolved = resolveCanonicalPatientIds([
    { id: 1, mergedIntoPatientId: null },
    { id: 2, mergedIntoPatientId: 1 },
    { id: 3, mergedIntoPatientId: 2 },
  ]);
  assert.equal(resolved.get(1), 1);
  assert.equal(resolved.get(2), 1);
  assert.equal(resolved.get(3), 1);
});

test("renders the canonical composition as a sectioned OMOP note", () => {
  const content = buildSoapComposition({
    assessment: "Assessment text",
    authorId: 10,
    authorName: "Synthetic Author",
    encounteredAt: new Date("2026-01-01T10:00:00.000Z"),
    objective: "Objective text",
    patientName: "Synthetic Patient",
    plan: "Plan text",
    subjective: "Subjective text",
  });
  const text = compositionNoteText(content);
  assert.match(text, /^## Subjective\n\nSubjective text/);
  assert.match(text, /## Assessment\n\nAssessment text/);
  assert.match(text, /## Plan\n\nPlan text$/);
});

test("truncates only bounded OMOP source fields", () => {
  assert.equal(truncateSourceValue("abc", 5), "abc");
  assert.equal(truncateSourceValue("abcdef", 5), "abcde");
});
