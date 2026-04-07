import type { Contact, ContactPoint, Identifier, Patient as PatientRecord } from "@prisma/client";

export type PatientWithRelations = PatientRecord & {
  contacts: Contact[];
  identifier: Identifier[];
  mergedInto: Pick<PatientRecord, "id"> | null;
  replaces: Array<Pick<PatientRecord, "id">>;
  telecom: ContactPoint[];
};

function normalizeGender(gender: string) {
  const value = gender.toLowerCase();
  if (["male", "female", "other", "unknown"].includes(value)) {
    return value;
  }

  return "unknown";
}

export function toFhirPatient(patient: PatientWithRelations) {
  const links = [
    ...(patient.mergedInto
      ? [
          {
            other: { reference: `Patient/${patient.mergedInto.id}` },
            type: "replaced-by",
          },
        ]
      : []),
    ...patient.replaces.map((replacedPatient) => ({
      other: { reference: `Patient/${replacedPatient.id}` },
      type: "replaces",
    })),
  ];

  return {
    resourceType: "Patient",
    id: String(patient.id),
    active: patient.active,
    identifier: patient.identifier.map((identifier) => ({
      system: identifier.system,
      value: identifier.value,
    })),
    name: [{ text: patient.name }],
    gender: normalizeGender(patient.gender),
    ...(patient.birthDate
      ? {
          birthDate: patient.birthDate.toISOString().slice(0, 10),
        }
      : {}),
    ...(patient.isDraft
      ? {
          extension: [
            {
              url: "https://fhir-soap-record.example/StructureDefinition/patient-draft",
              valueBoolean: true,
            },
          ],
        }
      : {}),
    ...(links.length
      ? {
          link: links,
        }
      : {}),
    telecom: patient.telecom.map((contactPoint) => ({
      system: contactPoint.system,
      value: contactPoint.value,
    })),
    contact: patient.contacts.map((contact) => ({
      name: { text: contact.name },
      relationship: [{ text: contact.relationship }],
    })),
  };
}
