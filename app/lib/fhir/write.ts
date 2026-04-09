import { z } from "zod";

import { appointmentInputSchema, type AppointmentInput } from "~/lib/validation/appointments";
import { patientInputSchema, type PatientInput } from "~/lib/validation/patients";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const jsonPatchSchema = z.array(
  z.object({
    op: z.enum(["add", "remove", "replace", "test"]),
    path: z.string(),
    value: z.unknown().optional(),
  }),
);

type JsonPatchOperation = z.infer<typeof jsonPatchSchema>[number];

export type ParsedFhirPatient = {
  active: boolean;
  input: PatientInput;
};

export type ParsedFhirAppointment = {
  input: AppointmentInput;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateOnly(value: unknown, fieldName: string) {
  const trimmed = trimString(value);
  if (!trimmed) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

function parseDateTime(value: unknown, fieldName: string) {
  const trimmed = trimString(value);
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid dateTime.`);
  }

  return date;
}

function patientDraftFlag(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.extension)) {
    return false;
  }

  return resource.extension.some((item) => {
    const record = asRecord(item);
    return (
      record?.url ===
        "https://fhir-soap-record.example/StructureDefinition/patient-draft" &&
      record.valueBoolean === true
    );
  });
}

function primaryName(resource: Record<string, unknown>) {
  const name = Array.isArray(resource.name) ? resource.name[0] : undefined;
  const nameRecord = asRecord(name);

  if (!nameRecord) {
    return "";
  }

  if (typeof nameRecord.text === "string" && nameRecord.text.trim()) {
    return nameRecord.text.trim();
  }

  const given = Array.isArray(nameRecord.given)
    ? nameRecord.given.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const family = typeof nameRecord.family === "string" ? nameRecord.family : "";
  return [...given, family].join(" ").trim();
}

function normalizeGender(value: unknown): PatientInput["gender"] {
  const gender = typeof value === "string" ? value.toLowerCase() : "unknown";
  return ["female", "male", "other", "unknown"].includes(gender)
    ? (gender as PatientInput["gender"])
    : "unknown";
}

function parseIdentifierArray(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.identifier)) {
    return [];
  }

  return resource.identifier.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const system = trimString(record.system);
    const value = trimString(record.value);
    return system && value ? [{ system, value }] : [];
  });
}

function parseTelecomArray(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.telecom)) {
    return [];
  }

  return resource.telecom.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const system = trimString(record.system);
    const value = trimString(record.value);
    return system && value ? [{ system, value }] : [];
  });
}

function parseContactArray(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.contact)) {
    return [];
  }

  return resource.contact.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const nameRecord = asRecord(record.name);
    const relationshipRecord =
      Array.isArray(record.relationship) && record.relationship[0]
        ? asRecord(record.relationship[0])
        : null;

    const name =
      nameRecord && typeof nameRecord.text === "string" ? nameRecord.text.trim() : "";
    const relationship =
      relationshipRecord && typeof relationshipRecord.text === "string"
        ? relationshipRecord.text.trim()
        : "";

    return name && relationship ? [{ name, relationship }] : [];
  });
}

function appointmentPatientReference(resource: Record<string, unknown>) {
  if (!Array.isArray(resource.participant)) {
    return undefined;
  }

  for (const participant of resource.participant) {
    const participantRecord = asRecord(participant);
    const actorRecord = asRecord(participantRecord?.actor);
    if (actorRecord && typeof actorRecord.reference === "string") {
      return actorRecord.reference;
    }
  }

  return undefined;
}

function appointmentTypeText(resource: Record<string, unknown>) {
  const appointmentType = asRecord(resource.appointmentType);
  if (!appointmentType) {
    return "";
  }

  if (typeof appointmentType.text === "string" && appointmentType.text.trim()) {
    return appointmentType.text.trim();
  }

  const firstCoding =
    Array.isArray(appointmentType.coding) && appointmentType.coding[0]
      ? asRecord(appointmentType.coding[0])
      : null;

  if (firstCoding && typeof firstCoding.display === "string" && firstCoding.display.trim()) {
    return firstCoding.display.trim();
  }

  if (firstCoding && typeof firstCoding.code === "string" && firstCoding.code.trim()) {
    return firstCoding.code.trim();
  }

  return "";
}

export function parsePatientReference(reference: string | undefined) {
  const normalized = trimString(reference)
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
  const match = normalized.match(/(?:^|\/)Patient\/(\d+)$/);
  if (!match) {
    return null;
  }

  const patientId = Number(match[1]);
  return Number.isInteger(patientId) && patientId > 0 ? patientId : null;
}

function assertResourceType(resource: Record<string, unknown>, expected: string) {
  if (resource.resourceType !== expected) {
    throw new Error(`${expected} payload must declare resourceType "${expected}".`);
  }
}

export function getResourceId(resource: unknown) {
  const record = asRecord(resource);
  return record && typeof record.id === "string" ? record.id : undefined;
}

export function parseFhirPatientResource(resource: unknown): ParsedFhirPatient {
  const record = asRecord(resource);
  if (!record) {
    throw new Error("Patient payload must be a JSON object.");
  }

  assertResourceType(record, "Patient");

  const birthDate = parseDateOnly(record.birthDate, "Patient.birthDate");
  const isDraft = patientDraftFlag(record) || !birthDate;

  return {
    active: typeof record.active === "boolean" ? record.active : true,
    input: patientInputSchema.parse({
      birthDate,
      contacts: parseContactArray(record),
      gender: normalizeGender(record.gender),
      identifiers: parseIdentifierArray(record),
      isDraft,
      name: primaryName(record),
      telecom: parseTelecomArray(record),
    }),
  };
}

export function parseFhirAppointmentResource(resource: unknown): ParsedFhirAppointment {
  const record = asRecord(resource);
  if (!record) {
    throw new Error("Appointment payload must be a JSON object.");
  }

  assertResourceType(record, "Appointment");

  const patientId = parsePatientReference(appointmentPatientReference(record));
  if (!patientId) {
    throw new Error("Appointment participant.actor.reference must be Patient/{id}.");
  }

  return {
    input: appointmentInputSchema.parse({
      appointmentType: appointmentTypeText(record),
      end: parseDateTime(record.end, "Appointment.end"),
      patientId,
      start: parseDateTime(record.start, "Appointment.start"),
      status: trimString(record.status),
    }),
  };
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function decodePointer(path: string) {
  if (path === "") {
    return [] as string[];
  }

  if (!path.startsWith("/")) {
    throw new Error("JSON Patch paths must start with '/'.");
  }

  return path
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function readPath(target: JsonValue, tokens: string[]) {
  let current: JsonValue | undefined = target;

  for (const token of tokens) {
    if (Array.isArray(current)) {
      if (token === "-") {
        throw new Error("JSON Patch '-' cannot be used when reading.");
      }

      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error(`JSON Patch path does not exist: /${tokens.join("/")}`);
      }

      current = current[index];
      continue;
    }

    const record = asRecord(current);
    if (!record || !(token in record)) {
      throw new Error(`JSON Patch path does not exist: /${tokens.join("/")}`);
    }

    current = record[token] as JsonValue;
  }

  return current;
}

function getContainer(target: JsonValue, tokens: string[]) {
  if (!tokens.length) {
    return { key: "", parent: null as JsonValue[] | JsonObject | null };
  }

  const parentTokens = tokens.slice(0, -1);
  const key = tokens[tokens.length - 1];
  const parent = parentTokens.length ? readPath(target, parentTokens) : target;

  if (!Array.isArray(parent) && !asRecord(parent)) {
    throw new Error(`JSON Patch parent is not a container: /${parentTokens.join("/")}`);
  }

  return { key, parent: parent as JsonValue[] | JsonObject };
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requirePatchValue(operation: JsonPatchOperation) {
  if (operation.value === undefined) {
    throw new Error(`JSON Patch operation '${operation.op}' requires a value.`);
  }

  return deepCloneJson(operation.value) as JsonValue;
}

function applyJsonPatchOperation(document: JsonValue, operation: JsonPatchOperation) {
  const tokens = decodePointer(operation.path);

  if (operation.op === "test") {
    const currentValue = tokens.length ? readPath(document, tokens) : document;
    if (!valuesEqual(currentValue, operation.value)) {
      throw new Error(`JSON Patch test failed at path ${operation.path}.`);
    }

    return document;
  }

  if (!tokens.length) {
    if (operation.op === "remove") {
      throw new Error("JSON Patch cannot remove the document root.");
    }

    return requirePatchValue(operation);
  }

  const { key, parent } = getContainer(document, tokens);
  if (!parent) {
    throw new Error(`JSON Patch path does not exist: ${operation.path}`);
  }

  if (Array.isArray(parent)) {
    if (operation.op === "add") {
      if (key === "-") {
        parent.push(requirePatchValue(operation));
        return document;
      }

      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index > parent.length) {
        throw new Error(`JSON Patch array index is invalid: ${operation.path}`);
      }

      parent.splice(index, 0, requirePatchValue(operation));
      return document;
    }

    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
      throw new Error(`JSON Patch array index is invalid: ${operation.path}`);
    }

    if (operation.op === "remove") {
      parent.splice(index, 1);
      return document;
    }

    parent[index] = requirePatchValue(operation);
    return document;
  }

  if (operation.op === "add") {
    parent[key] = requirePatchValue(operation);
    return document;
  }

  if (!(key in parent)) {
    throw new Error(`JSON Patch path does not exist: ${operation.path}`);
  }

  if (operation.op === "remove") {
    delete parent[key];
    return document;
  }

  parent[key] = requirePatchValue(operation);
  return document;
}

function applyJsonPatch(target: JsonValue, patch: unknown) {
  let document = deepCloneJson(target);

  for (const operation of jsonPatchSchema.parse(patch)) {
    document = applyJsonPatchOperation(document, operation);
  }

  return document;
}

function applyMergePatch(target: JsonValue, patch: unknown): JsonValue {
  const patchRecord = asRecord(patch);
  if (!patchRecord) {
    return deepCloneJson(patch) as JsonValue;
  }

  const base: JsonObject = asRecord(target)
    ? (deepCloneJson(target) as JsonObject)
    : {};

  for (const [key, value] of Object.entries(patchRecord)) {
    if (value === null) {
      delete base[key];
      continue;
    }

    base[key] = applyMergePatch((base[key] ?? null) as JsonValue, value);
  }

  return base;
}

export function applyFhirPatch(
  existingResource: unknown,
  patchBody: unknown,
  contentType: string | null,
) {
  const normalizedContentType = contentType?.split(";")[0].trim().toLowerCase() ?? "";
  const baseResource = deepCloneJson(existingResource) as JsonValue;

  if (normalizedContentType === "application/json-patch+json") {
    return applyJsonPatch(baseResource, patchBody);
  }

  if (
    normalizedContentType === "application/merge-patch+json" ||
    normalizedContentType === "application/json" ||
    normalizedContentType === "application/fhir+json"
  ) {
    return applyMergePatch(baseResource, patchBody);
  }

  throw new Error(
    "PATCH requires application/json-patch+json or application/merge-patch+json.",
  );
}
