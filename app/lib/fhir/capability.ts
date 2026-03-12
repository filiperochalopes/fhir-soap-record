export function fhirJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/fhir+json; charset=utf-8",
    },
  });
}

export function capabilityStatement(baseUrl: string) {
  return {
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    kind: "instance",
    format: ["application/fhir+json"],
    fhirVersion: "4.0.1",
    implementation: {
      description: "FHIR-oriented MVP API for the clinical monolith.",
      url: baseUrl,
    },
    software: {
      name: "fhir-soap-record",
      version: "0.1.0",
    },
    rest: [
      {
        mode: "server",
        resource: [
          { type: "Patient", interaction: [{ code: "read" }, { code: "search-type" }] },
          { type: "Appointment", interaction: [{ code: "read" }, { code: "search-type" }] },
          { type: "Composition", interaction: [{ code: "read" }, { code: "search-type" }] },
          { type: "Encounter", interaction: [{ code: "read" }] },
          { type: "Observation", interaction: [{ code: "read" }] },
          { type: "Condition", interaction: [{ code: "read" }] },
          { type: "ClinicalImpression", interaction: [{ code: "read" }] },
        ],
      },
    ],
  };
}
