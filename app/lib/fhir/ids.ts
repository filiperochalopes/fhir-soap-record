function parseLegacyOrPrefixedId(id: string, prefix: string) {
  if (/^\d+$/.test(id)) {
    return Number(id);
  }

  if (!id.startsWith(prefix)) {
    return null;
  }

  const numericId = Number(id.slice(prefix.length));
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
}

export function toSoapCompositionFhirId(id: number) {
  return `soap-note-${id}`;
}

export function toSoapEncounterFhirId(id: number) {
  return `soap-encounter-${id}`;
}

export function toSoapObservationFhirId(id: number) {
  return `soap-observation-${id}`;
}

export function toSoapConditionFhirId(id: number) {
  return `soap-condition-${id}`;
}

export function toSoapClinicalImpressionFhirId(id: number) {
  return `soap-clinical-impression-${id}`;
}

export function toNarrativeCompositionFhirId(id: number) {
  return `narrative-note-${id}`;
}

export function parseSoapCompositionFhirId(id: string) {
  return parseLegacyOrPrefixedId(id, "soap-note-");
}

export function parseSoapEncounterFhirId(id: string) {
  return parseLegacyOrPrefixedId(id, "soap-encounter-");
}

export function parseSoapObservationFhirId(id: string) {
  return parseLegacyOrPrefixedId(id, "soap-observation-");
}

export function parseSoapConditionFhirId(id: string) {
  return parseLegacyOrPrefixedId(id, "soap-condition-");
}

export function parseSoapClinicalImpressionFhirId(id: string) {
  return parseLegacyOrPrefixedId(id, "soap-clinical-impression-");
}

export function parseCompositionFhirId(id: string) {
  const soapId = parseSoapCompositionFhirId(id);
  if (soapId) {
    return { kind: "soap" as const, noteId: soapId };
  }

  const narrativeId = parseLegacyOrPrefixedId(id, "narrative-note-");
  if (narrativeId) {
    return { kind: "narrative" as const, noteId: narrativeId };
  }

  return null;
}
