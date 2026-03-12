import { requireApiUser } from "~/lib/auth.server";
import { toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirPatient } from "~/lib/fhir/patient";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim();

  const patients = await prisma.patient.findMany({
    where: name
      ? {
          name: { contains: name },
        }
      : undefined,
    include: {
      contacts: true,
      identifier: true,
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

