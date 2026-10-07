function parsePrefixedId(id: string, prefix: string) {
  if (!id.startsWith(prefix)) {
    return null;
  }
  const value = id.slice(prefix.length).trim();
  return value || null;
}

export function toSoapCompositionFhirId(id: string) {
  return `soap-note-${id}`;
}

export function toSoapEncounterFhirId(id: string) {
  return `soap-encounter-${id}`;
}

export function toSoapObservationFhirId(id: string) {
  return `soap-observation-${id}`;
}

export function toSoapConditionFhirId(id: string) {
  return `soap-condition-${id}`;
}

export function toSoapClinicalImpressionFhirId(id: string) {
  return `soap-clinical-impression-${id}`;
}

export function toNarrativeCompositionFhirId(id: string) {
  return `narrative-note-${id}`;
}

export function parseSoapCompositionFhirId(id: string) {
  return parsePrefixedId(id, "soap-note-");
}

export function parseSoapEncounterFhirId(id: string) {
  return parsePrefixedId(id, "soap-encounter-");
}

export function parseSoapObservationFhirId(id: string) {
  return parsePrefixedId(id, "soap-observation-");
}

export function parseSoapConditionFhirId(id: string) {
  return parsePrefixedId(id, "soap-condition-");
}

export function parseSoapClinicalImpressionFhirId(id: string) {
  return parsePrefixedId(id, "soap-clinical-impression-");
}

export function parseCompositionFhirId(id: string) {
  const soapId = parseSoapCompositionFhirId(id);
  if (soapId) {
    return { kind: "soap" as const, versionId: soapId };
  }

  const narrativeId = parsePrefixedId(id, "narrative-note-");
  if (narrativeId) {
    return { kind: "narrative" as const, versionId: narrativeId };
  }

  return null;
}
