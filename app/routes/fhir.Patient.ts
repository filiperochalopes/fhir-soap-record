import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome, toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirPatient } from "~/lib/fhir/patient";
import { parseFhirPatientResource } from "~/lib/fhir/write";
import { savePatient } from "~/lib/patients.server";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim();

  const patients = await prisma.patient.findMany({
    where: name
      ? {
          active: true,
          name: { contains: name },
        }
      : { active: true },
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
    take: 100,
    orderBy: {
      name: "asc",
    },
  });

  return fhirJson(
    toSearchBundle(
      "Patient",
      patients.map(toFhirPatient),
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
    const payload = parseFhirPatientResource(await request.json());
    const patient = await savePatient(payload.input, auth.user.id, undefined, {
      active: payload.active,
    });
    const url = new URL(request.url);

    return fhirJson(toFhirPatient(patient), 201, {
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
        operationOutcome("error", "conflict", "Patient identifiers must be unique."),
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
