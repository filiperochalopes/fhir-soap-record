import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirPatient } from "~/lib/fhir/patient";
import { applyFhirPatch, getResourceId, parseFhirPatientResource } from "~/lib/fhir/write";
import { PATIENT_DUPLICATE_IDENTITY_MESSAGE, savePatient } from "~/lib/patients.server";
import { prisma } from "~/lib/prisma.server";

async function loadPatient(patientId: number) {
  return prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      contacts: true,
      identifier: true,
      mergedInto: {
        select: {
          id: true,
        },
      },
      replaces: {
        select: {
          id: true,
        },
      },
      telecom: true,
    },
  });
}

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const patient = await loadPatient(Number(params.id));

  if (!patient) {
    return fhirJson(operationOutcome("error", "not-found", "Patient not found"), 404);
  }

  return fhirJson(toFhirPatient(patient));
}

export async function action({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  if (request.method !== "PUT" && request.method !== "PATCH") {
    return fhirJson(
      operationOutcome("error", "not-supported", "Method not allowed."),
      405,
      {
        Allow: "GET, PUT, PATCH",
      },
    );
  }

  const auth = await requireApiUser(request);
  const patientId = Number(params.id);

  if (!Number.isInteger(patientId) || patientId <= 0) {
    return fhirJson(operationOutcome("error", "not-found", "Patient not found"), 404);
  }

  const existingPatient = await loadPatient(patientId);
  if (!existingPatient) {
    return fhirJson(operationOutcome("error", "not-found", "Patient not found"), 404);
  }

  try {
    const body = await request.json();
    const resource =
      request.method === "PATCH"
        ? applyFhirPatch(
            toFhirPatient(existingPatient),
            body,
            request.headers.get("content-type"),
          )
        : body;
    const bodyId = getResourceId(resource);

    if (bodyId && bodyId !== String(patientId)) {
      return fhirJson(
        operationOutcome("error", "invalid", "Patient.id must match the request path."),
        400,
      );
    }

    const payload = parseFhirPatientResource(resource);
    const patient = await savePatient(payload.input, auth.user.id, patientId, {
      active: payload.active,
    });

    return fhirJson(toFhirPatient(patient));
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
        operationOutcome("error", "conflict", "Patient identifiers must be unique."),
        409,
      );
    }

    if (error instanceof Error && error.message === PATIENT_DUPLICATE_IDENTITY_MESSAGE) {
      return fhirJson(
        operationOutcome("error", "conflict", PATIENT_DUPLICATE_IDENTITY_MESSAGE),
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
