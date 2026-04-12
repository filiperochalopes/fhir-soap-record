export const FHIR_SOAP_RECORD_ERROR_SYSTEM =
  "https://fhir-soap-record.example/CodeSystem/operation-outcome";

export const FHIR_APP_ERROR_CODES = {
  patientIdentifierDuplicate: "patient-identifier-duplicate",
  patientNameBirthDateDuplicate: "patient-name-birth-date-duplicate",
} as const;

export type FhirAppErrorCode =
  (typeof FHIR_APP_ERROR_CODES)[keyof typeof FHIR_APP_ERROR_CODES];

const FHIR_APP_ERROR_DISPLAYS: Record<FhirAppErrorCode, string> = {
  [FHIR_APP_ERROR_CODES.patientIdentifierDuplicate]:
    "Patient identifier already exists",
  [FHIR_APP_ERROR_CODES.patientNameBirthDateDuplicate]:
    "Patient with same name and birth date already exists",
};

export function fhirAppErrorCoding(code: FhirAppErrorCode) {
  return {
    code,
    display: FHIR_APP_ERROR_DISPLAYS[code],
    system: FHIR_SOAP_RECORD_ERROR_SYSTEM,
  };
}
