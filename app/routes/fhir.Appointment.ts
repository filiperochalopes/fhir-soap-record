import { requireApiUser } from "~/lib/auth.server";
import { toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirAppointment } from "~/lib/fhir/appointment";
import { prisma } from "~/lib/prisma.server";
import { endOfDay, startOfDay } from "~/lib/utils";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patient = url.searchParams.get("patient");
  const date = url.searchParams.get("date");
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
      patient: true,
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
    ),
  );
}

