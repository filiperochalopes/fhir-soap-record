import { ZodError } from "zod";

import { saveAppointment } from "~/lib/appointments.server";
import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome } from "~/lib/fhir/bundle";
import { toFhirAppointment } from "~/lib/fhir/appointment";
import { fhirJson } from "~/lib/fhir/capability";
import {
  applyFhirPatch,
  getResourceId,
  parseFhirAppointmentResource,
} from "~/lib/fhir/write";
import { prisma } from "~/lib/prisma.server";

async function loadAppointment(appointmentId: number) {
  return prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: true,
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

  const appointment = await loadAppointment(Number(params.id));

  if (!appointment) {
    return fhirJson(operationOutcome("error", "not-found", "Appointment not found"), 404);
  }

  return fhirJson(toFhirAppointment(appointment));
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
  const appointmentId = Number(params.id);

  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return fhirJson(operationOutcome("error", "not-found", "Appointment not found"), 404);
  }

  const existingAppointment = await loadAppointment(appointmentId);
  if (!existingAppointment) {
    return fhirJson(operationOutcome("error", "not-found", "Appointment not found"), 404);
  }

  try {
    const body = await request.json();
    const resource =
      request.method === "PATCH"
        ? applyFhirPatch(
            toFhirAppointment(existingAppointment),
            body,
            request.headers.get("content-type"),
          )
        : body;
    const bodyId = getResourceId(resource);

    if (bodyId && bodyId !== String(appointmentId)) {
      return fhirJson(
        operationOutcome("error", "invalid", "Appointment.id must match the request path."),
        400,
      );
    }

    const payload = parseFhirAppointmentResource(resource);
    const appointment = await saveAppointment(payload.input, auth.user.id, appointmentId);

    return fhirJson(toFhirAppointment(appointment));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return fhirJson(operationOutcome("error", "invalid", "Invalid JSON body."), 400);
    }

    if (error instanceof ZodError) {
      return fhirJson(
        operationOutcome(
          "error",
          "invalid",
          error.issues[0]?.message ?? "Appointment payload is invalid.",
        ),
        400,
      );
    }

    return fhirJson(
      operationOutcome(
        "error",
        "invalid",
        error instanceof Error ? error.message : "Appointment payload is invalid.",
      ),
      400,
    );
  }
}
