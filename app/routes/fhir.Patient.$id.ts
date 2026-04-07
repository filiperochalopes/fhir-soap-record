import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirPatient } from "~/lib/fhir/patient";
import { prisma } from "~/lib/prisma.server";

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const patient = await prisma.patient.findUnique({
    where: { id: Number(params.id) },
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

  if (!patient) {
    return fhirJson(operationOutcome("error", "not-found", "Patient not found"), 404);
  }

  return fhirJson(toFhirPatient(patient));
}
