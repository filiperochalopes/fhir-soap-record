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
