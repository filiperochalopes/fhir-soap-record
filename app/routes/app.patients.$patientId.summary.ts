import { requireUserSession } from "~/lib/auth.server";
import { generateClinicalSummary } from "~/lib/clinical-summary.server";
import { getPatientClinicalCompositions } from "~/lib/ehr/compositions.server";
import { prisma } from "~/lib/prisma.server";

export async function loader({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  await requireUserSession(request);

  const patientId = Number(params.patientId);
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      birthDate: true,
      gender: true,
      name: true,
    },
  });

  if (!patient) {
    throw new Response("Patient not found", { status: 404 });
  }

  const soapNotes = (await getPatientClinicalCompositions(patientId)).filter(
    (composition) => composition.kind === "soap",
  );
  const summary = await generateClinicalSummary({
    patient,
    soapNotes,
  });

  return Response.json({ summary });
}
