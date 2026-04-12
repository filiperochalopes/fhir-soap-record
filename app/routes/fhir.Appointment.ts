import { ZodError } from "zod";

import { requireApiUser } from "~/lib/auth.server";
import { operationOutcome, toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { getFhirStore } from "~/lib/fhir/store.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patient = url.searchParams.get("patient");
  const date = url.searchParams.get("date");
  const includePatient = url.searchParams.getAll("_include").includes("Appointment:patient");
  const appointments = await getFhirStore().searchAppointments({
    date,
    includePatient,
    patient,
  });

  return fhirJson(
    toSearchBundle(
      "Appointment",
      appointments.resources,
      url.origin,
      appointments.included,
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
    const appointment = await getFhirStore().saveAppointment(
      await request.json(),
      auth.user.id,
    );
    const url = new URL(request.url);

    return fhirJson(appointment, 201, {
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
