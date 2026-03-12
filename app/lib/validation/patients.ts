import { z } from "zod";

import {
  extractRepeatedPairs,
  parseDateInput,
  pickFirstString,
} from "~/lib/utils";

const identifierSchema = z.object({
  system: z.string().trim().min(1, "Identifier system is required"),
  value: z.string().trim().min(1, "Identifier value is required"),
});

const telecomSchema = z.object({
  system: z.string().trim().min(1, "Telecom system is required"),
  value: z.string().trim().min(1, "Telecom value is required"),
});

const contactSchema = z.object({
  name: z.string().trim().min(1, "Contact name is required"),
  relationship: z.string().trim().min(1, "Relationship is required"),
});

export const genderSchema = z.enum(["male", "female", "other", "unknown"]);

export const patientInputSchema = z.object({
  birthDate: z.coerce.date(),
  contacts: z.array(contactSchema),
  gender: genderSchema,
  identifiers: z.array(identifierSchema),
  name: z.string().trim().min(3, "Name is required"),
  telecom: z.array(telecomSchema),
});

export type PatientInput = z.infer<typeof patientInputSchema>;

export function parsePatientForm(formData: FormData) {
  const identifiers = extractRepeatedPairs(
    formData,
    "identifierSystem",
    "identifierValue",
  ).map((item) => ({
    system: item.first,
    value: item.second,
  }));

  const telecom = extractRepeatedPairs(formData, "telecomSystem", "telecomValue").map(
    (item) => ({
      system: item.first,
      value: item.second,
    }),
  );

  const contacts = extractRepeatedPairs(formData, "contactName", "contactRelationship").map(
    (item) => ({
      name: item.first,
      relationship: item.second,
    }),
  );

  return patientInputSchema.parse({
    birthDate: parseDateInput(pickFirstString(formData.get("birthDate"))),
    contacts,
    gender: pickFirstString(formData.get("gender")),
    identifiers,
    name: pickFirstString(formData.get("name")),
    telecom,
  });
}

export const patientSearchSchema = z.object({
  q: z.string().trim().optional(),
});

export const patientImportSchema = z.object({
  birthDate: z.coerce.date(),
  contacts: z.array(contactSchema).default([]),
  externalId: z.string().trim().optional(),
  gender: genderSchema,
  identifiers: z.array(identifierSchema).default([]),
  name: z.string().trim().min(3),
  soapNotes: z
    .array(
      z.object({
        assessment: z.string().trim().min(1),
        encounteredAt: z.coerce.date(),
        objective: z.string().trim().min(1),
        plan: z.string().trim().min(1),
        sourceRecordId: z.string().trim().min(1),
        subjective: z.string().trim().min(1),
      }),
    )
    .default([]),
  telecom: z.array(telecomSchema).default([]),
});

