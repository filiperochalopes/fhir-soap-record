import { requireUserSession } from "~/lib/auth.server";
import {
  consumeDocsWebhookSuggestion,
  listPendingDocsWebhookSuggestions,
} from "~/lib/plugins/docs/integration.server";

function parsePatientId(value?: string) {
  const patientId = Number(value);
  return Number.isInteger(patientId) && patientId > 0 ? patientId : null;
}

export async function loader({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  const auth = await requireUserSession(request);
  const patientId = parsePatientId(params.patientId);
  if (!patientId) {
    return Response.json({ error: "patientId inválido." }, { status: 400 });
  }

  const suggestions = await listPendingDocsWebhookSuggestions({
    patientId,
    userId: auth.user.id,
  });

  return Response.json({ suggestions });
}

export async function action({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  const auth = await requireUserSession(request);
  const patientId = parsePatientId(params.patientId);
  if (!patientId) {
    return Response.json({ error: "patientId inválido." }, { status: 400 });
  }

  const formData = await request.formData();
  const eventId = Number(formData.get("eventId"));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return Response.json({ error: "eventId inválido." }, { status: 400 });
  }

  await consumeDocsWebhookSuggestion({
    eventId,
    patientId,
    userId: auth.user.id,
  });

  return Response.json({ ok: true });
}
