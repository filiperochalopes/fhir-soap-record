import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { toFhirAppointment } from "~/lib/fhir/appointment";
import { fhirJson } from "~/lib/fhir/capability";
import { prisma } from "~/lib/prisma.server";

export async function loader({
  params,
  request,
}: {
  params: { id?: string };
  request: Request;
}) {
  await requireApiUser(request);

  const appointment = await prisma.appointment.findUnique({
    where: { id: Number(params.id) },
    include: {
      patient: true,
    },
  });

  if (!appointment) {
    return fhirJson(operationOutcome("error", "not-found", "Appointment not found"), 404);
  }

  return fhirJson(toFhirAppointment(appointment));
}

