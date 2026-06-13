import { getAttachmentPluginProcessor } from "~/lib/attachment-plugins/registry.server";
import type {
  AttachmentPluginExecutionSummary,
  AttachmentPluginStatus,
} from "~/lib/attachment-plugins/types";
import { requireUserSession } from "~/lib/auth.server";

function parsePositiveInt(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toSummary(execution: {
  error: string | null;
  externalJobId: string | null;
  pluginId: string;
  status: string;
  summary: string | null;
}): AttachmentPluginExecutionSummary {
  return {
    error: execution.error,
    externalJobId: execution.externalJobId,
    pluginId: execution.pluginId,
    status: execution.status as AttachmentPluginStatus,
    summary: execution.summary,
  };
}

export async function action({
  params,
  request,
}: {
  params: {
    attachmentId?: string;
    patientId?: string;
    pluginId?: string;
  };
  request: Request;
}) {
  const auth = await requireUserSession(request);
  const attachmentId = parsePositiveInt(params.attachmentId);
  const patientId = parsePositiveInt(params.patientId);
  const pluginId = params.pluginId?.trim();
  if (!attachmentId || !patientId || !pluginId) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "start");
    const processor = getAttachmentPluginProcessor(pluginId);
    const context = {
      attachmentId,
      patientId,
      userId: auth.user.id,
    };
    const execution =
      intent === "refresh"
        ? await processor.refresh(context)
        : intent === "start"
          ? await processor.start(context)
          : null;

    if (!execution) {
      return Response.json({ error: "Intent inválido." }, { status: 400 });
    }
    return Response.json({ execution: toSummary(execution) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar plugin de anexo.",
      },
      { status: 400 },
    );
  }
}
