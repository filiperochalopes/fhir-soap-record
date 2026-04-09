import { ZodError } from "zod";

import { saveAppointment } from "~/lib/appointments.server";
import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome, toSearchBundle } from "~/lib/fhir/bundle";
import { toFhirPatient } from "~/lib/fhir/patient";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirAppointment } from "~/lib/fhir/appointment";
import { parseFhirAppointmentResource } from "~/lib/fhir/write";
import { prisma } from "~/lib/prisma.server";
import { endOfDay, startOfDay } from "~/lib/utils";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patient = url.searchParams.get("patient");
  const date = url.searchParams.get("date");
  const includePatient = url.searchParams.getAll("_include").includes("Appointment:patient");
  const dateFilter = date ? new Date(`${date}T00:00:00`) : null;

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(patient ? { patientId: Number(patient) } : {}),
      ...(dateFilter
        ? {
            start: {
              gte: startOfDay(dateFilter),
              lte: endOfDay(dateFilter),
            },
          }
        : {}),
    },
    include: {
      patient: {
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
      },
    },
    orderBy: {
      start: "asc",
    },
  });

  return fhirJson(
    toSearchBundle(
      "Appointment",
      appointments.map(toFhirAppointment),
      url.origin,
      includePatient ? appointments.map((appointment) => toFhirPatient(appointment.patient)) : [],
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
    const payload = parseFhirAppointmentResource(await request.json());
    const appointment = await saveAppointment(payload.input, auth.user.id);
    const url = new URL(request.url);

    return fhirJson(toFhirAppointment(appointment), 201, {
      Location: `${url.origin}/fhir/Appointment/${appointment.id}`,
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
