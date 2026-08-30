import { createNarrativeComposition, createSoapComposition, getPatientClinicalCompositions } from "../app/lib/ehr/compositions.server";
import { prisma } from "../app/lib/prisma.server";

async function main() {
  const author = await prisma.authUser.upsert({
    where: { crm_crmUf: { crm: "V2-SYNTHETIC", crmUf: "BA" } },
    create: { crm: "V2-SYNTHETIC", crmUf: "BA", fullName: "Dra. Ada V2" },
    update: { fullName: "Dra. Ada V2", isActive: true },
  });
  const identifier = await prisma.identifier.findUnique({
    where: {
      system_value: {
        system: "urn:soap-ehr:synthetic:patient",
        value: "V2-1001",
      },
    },
    select: { patientId: true },
  });
  const patient = identifier?.patientId
    ? await prisma.patient.findUniqueOrThrow({ where: { id: identifier.patientId } })
    : await prisma.patient.create({
        data: {
          birthDate: new Date("1984-03-15T00:00:00.000Z"),
          gender: "female",
          identifier: {
            create: {
              system: "urn:soap-ehr:synthetic:patient",
              value: "V2-1001",
            },
          },
          name: "Paciente Sintético V2",
        },
      });
  const appointment =
    (await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        start: new Date("2026-03-01T13:00:00.000Z"),
      },
    })) ??
    (await prisma.appointment.create({
      data: {
        appointmentType: "Consulta V2 sintética",
        end: new Date("2026-03-01T13:30:00.000Z"),
        patientId: patient.id,
        start: new Date("2026-03-01T13:00:00.000Z"),
        status: "booked",
      },
    }));

  await createSoapComposition({
    appointmentId: appointment.id,
    assessment: "Avaliação sintética V2.",
    authorUserId: author.id,
    encounteredAt: new Date("2026-03-01T13:05:00.000Z"),
    objective: "Exame objetivo sintético V2.",
    patientId: patient.id,
    plan: "Plano sintético V2.",
    sourceRecordId: "soap-1",
    sourceSystem: "soap-ehr-v2-seed",
    subjective: "História subjetiva sintética V2.",
  });
  await createNarrativeComposition({
    authorUserId: author.id,
    encounteredAt: new Date("2026-03-02T10:00:00.000Z"),
    patientId: patient.id,
    sections: [{ title: "Evolução", text: "Evolução narrativa sintética V2." }],
    sourceRecordId: "narrative-1",
    sourceSystem: "soap-ehr-v2-seed",
    title: "Nota narrativa V2",
  });

  const compositions = await getPatientClinicalCompositions(patient.id);
  console.log(
    JSON.stringify({
      compositionCount: compositions.length,
      patientId: patient.id,
      templates: compositions.map((composition) => composition.templateId),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
