import { requireApiUser } from "~/lib/auth.server";
import { toSearchBundle } from "~/lib/fhir/bundle";
import { fhirJson } from "~/lib/fhir/capability";
import { toFhirNarrativeComposition } from "~/lib/fhir/narrative";
import { toFhirComposition } from "~/lib/fhir/soap";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request }: { request: Request }) {
  await requireApiUser(request);

  const url = new URL(request.url);
  const patient = url.searchParams.get("patient");

  const [soapNotes, narrativeNotes] = await Promise.all([
    prisma.soapNote.findMany({
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
    }),
    prisma.narrativeNote.findMany({
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
    }),
  ]);

  const resources = [
    ...soapNotes.map(toFhirComposition),
    ...narrativeNotes.map(toFhirNarrativeComposition),
  ].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );

  return fhirJson(
    toSearchBundle(
      "Composition",
      resources,
      url.origin,
    ),
  );
}
