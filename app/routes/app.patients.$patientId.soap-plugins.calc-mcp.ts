import { requireUserSession } from "~/lib/auth.server";
import { runCalcMcpAgent } from "~/lib/ai/mcp.server";
import { prisma } from "~/lib/prisma.server";
import { anonymizePayload } from "~/lib/soap-plugins/anonymize";
import { getPatientSoapNotes } from "~/lib/soap-notes.server";

export async function action({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  await requireUserSession(request);

  const patientId = Number(params.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    return Response.json({ error: "patientId inválido" }, { status: 400 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { birthDate: true, gender: true },
  });

  if (!patient) {
    return Response.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const formData = await request.formData();
  const scope = formData.get("scope") === "current_history" ? "current_history" : "current";

  const draft = {
    subjective: String(formData.get("subjective") ?? ""),
    objective: String(formData.get("objective") ?? ""),
    assessment: String(formData.get("assessment") ?? ""),
    plan: String(formData.get("plan") ?? ""),
  };

  const hasDraft = Object.values(draft).some((value) => value.trim().length > 0);
  if (!hasDraft) {
    return Response.json(
      { error: "Preencha ao menos um campo do SOAP em edição antes de executar." },
      { status: 400 },
    );
  }

  let history: Array<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    encounteredAt: Date;
  }> = [];

  if (scope === "current_history") {
    const notes = await getPatientSoapNotes(patientId);
    history = notes.map((note) => ({
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      encounteredAt: note.encounteredAt,
    }));
  }

  const payload = anonymizePayload({
    patient,
    current: draft,
    history: history.length ? history : undefined,
  });

  if (!payload) {
    return Response.json(
      { error: "Idade indisponível, não é possível calcular scores." },
      { status: 400 },
    );
  }

  try {
    const { narrative, toolResults } = await runCalcMcpAgent(payload);
    return Response.json({ narrative, toolResults, request: payload });
  } catch (error) {
    console.error("Calc MCP agent failed", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar o agente MCP.",
      },
      { status: 500 },
    );
  }
}
