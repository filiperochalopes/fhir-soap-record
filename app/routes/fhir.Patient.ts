import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome, toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { FHIR_APP_ERROR_CODES } from "~/lib/fhir/errors";
import { getFhirStore } from "~/lib/fhir/store.server";
import { PATIENT_DUPLICATE_IDENTITY_MESSAGE } from "~/lib/patients.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim();
  const patients = await getFhirStore().searchPatients({ name: name || null });

  return fhirJson(
    toSearchBundle(
      "Patient",
      patients,
      url.origin,
    ),
  );
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return fhirJson(
      operationOutcome("error", "not-supported", "Method not allowed."),
      405,
      {
        Allow: "GET, POST",
      },
    );
  }

  const auth = await requireApiUser(request);

  try {
    const patient = await getFhirStore().savePatient(await request.json(), auth.user.id);
    const url = new URL(request.url);

    return fhirJson(patient, 201, {
      Location: `${url.origin}/fhir/Patient/${patient.id}`,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fhirJson(operationOutcome("error", "invalid", "Invalid JSON body."), 400);
    }

    if (error instanceof ZodError) {
      return fhirJson(
        operationOutcome(
          "error",
          "invalid",
          error.issues[0]?.message ?? "Patient payload is invalid.",
        ),
        400,
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fhirJson(
        operationOutcome(
          "error",
          "duplicate",
          "Patient identifier already exists.",
          undefined,
          {
            appCode: FHIR_APP_ERROR_CODES.patientIdentifierDuplicate,
            expression: ["Patient.identifier"],
          },
        ),
        409,
      );
    }

    if (error instanceof Error && error.message === PATIENT_DUPLICATE_IDENTITY_MESSAGE) {
      return fhirJson(
        operationOutcome(
          "error",
          "duplicate",
          PATIENT_DUPLICATE_IDENTITY_MESSAGE,
          undefined,
          {
            appCode: FHIR_APP_ERROR_CODES.patientNameBirthDateDuplicate,
            expression: ["Patient.name", "Patient.birthDate"],
          },
        ),
        409,
      );
    }

    return fhirJson(
      operationOutcome(
        "error",
        "invalid",
        error instanceof Error ? error.message : "Patient payload is invalid.",
      ),
      400,
    );
  }
}
