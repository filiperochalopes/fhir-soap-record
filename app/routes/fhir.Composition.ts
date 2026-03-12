import { requireApiUser } from "~/lib/auth.server";
import { toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirComposition } from "~/lib/fhir/soap";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patient = url.searchParams.get("patient");

  const notes = await prisma.soapNote.findMany({
    where: patient ? { patientId: Number(patient) } : undefined,
    include: {
      author: true,
      patient: {
        include: {
          contacts: true,
          identifier: true,
          telecom: true,
        },
      },
    },
    orderBy: {
      encounteredAt: "desc",
    },
  });

  return fhirJson(
    toSearchBundle(
      "Composition",
      notes.map(toFhirComposition),
      url.origin,
    ),
  );
}

