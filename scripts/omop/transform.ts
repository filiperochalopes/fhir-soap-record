import type { EhrComposition } from "../../app/lib/ehr/rm";
import { compositionNarrativeSections } from "../../app/lib/ehr/rm";

export const OMOP_CONCEPT = {
  ehrType: 32817,
  femaleGender: 8532,
  maleGender: 8507,
  noMatchingConcept: 0,
  outpatientVisit: 9202,
} as const;

export function genderConceptId(gender: string) {
  const normalized = gender.trim().toLowerCase();
  if (normalized === "female") {
    return OMOP_CONCEPT.femaleGender;
  }
  if (normalized === "male") {
    return OMOP_CONCEPT.maleGender;
  }
  return OMOP_CONCEPT.noMatchingConcept;
}

export function truncateSourceValue(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function compositionNoteText(content: EhrComposition) {
  return compositionNarrativeSections(content)
    .map((section) => `## ${section.title}\n\n${section.text}`)
    .join("\n\n");
}

export function resolveCanonicalPatientIds(
  patients: Array<{ id: number; mergedIntoPatientId: number | null }>,
) {
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const resolved = new Map<number, number>();

  function resolve(patientId: number, path: Set<number>): number {
    const cached = resolved.get(patientId);
    if (cached != null) {
      return cached;
    }
    if (path.has(patientId)) {
      throw new Error(`Patient merge cycle detected at Patient/${patientId}.`);
    }
    const patient = byId.get(patientId);
    if (!patient) {
      throw new Error(`Patient/${patientId} references a missing merge target.`);
    }
    if (patient.mergedIntoPatientId == null) {
      resolved.set(patientId, patientId);
      return patientId;
    }
    path.add(patientId);
    const canonicalId = resolve(patient.mergedIntoPatientId, path);
    path.delete(patientId);
    resolved.set(patientId, canonicalId);
    return canonicalId;
  }

  for (const patient of patients) {
    resolve(patient.id, new Set());
  }
  return resolved;
}
