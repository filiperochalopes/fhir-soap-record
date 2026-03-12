import type { Contact, ContactPoint, Identifier, Patient } from "@prisma/client";

export type PatientWithRelations = Patient & {
  contacts: Contact[];
  identifier: Identifier[];
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
  return {
    resourceType: "Patient",
    id: String(patient.id),
    identifier: patient.identifier.map((identifier) => ({
      system: identifier.system,
      value: identifier.value,
    })),
    name: [{ text: patient.name }],
    gender: normalizeGender(patient.gender),
    birthDate: patient.birthDate.toISOString().slice(0, 10),
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

