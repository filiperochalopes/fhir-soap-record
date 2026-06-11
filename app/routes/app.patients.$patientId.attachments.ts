import { requireUserSession } from "~/lib/auth.server";
import {
  listPatientAttachments,
  removeDraftAttachment,
  uploadDraftAttachment,
} from "~/lib/attachments.server";

function parsePatientId(value?: string) {
  const patientId = Number(value);
  return Number.isInteger(patientId) && patientId > 0 ? patientId : null;
}

function parseOptionalPositiveInt(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
    return Response.json({ error: "patientId inválido" }, { status: 400 });
  }

  const url = new URL(request.url);
  const draftKey = url.searchParams.get("draftKey");
  const attachments = await listPatientAttachments({
    authorUserId: auth.user.id,
    draftKey,
    patientId,
  });

  return Response.json(attachments);
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
    return Response.json({ error: "patientId inválido" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "upload");

    if (intent === "delete") {
      const attachmentId = parseOptionalPositiveInt(formData.get("attachmentId"));
      if (!attachmentId) {
        return Response.json({ error: "attachmentId inválido" }, { status: 400 });
      }

      await removeDraftAttachment({
        attachmentId,
        authorUserId: auth.user.id,
        patientId,
      });

      const draftKey = String(formData.get("draftKey") ?? "");
      return Response.json(
        await listPatientAttachments({
          authorUserId: auth.user.id,
          draftKey,
          patientId,
        }),
      );
    }

    const draftKey = String(formData.get("draftKey") ?? "").trim();
    const noteType = String(formData.get("noteType") ?? "soap").trim() || "soap";
    const appointmentId = parseOptionalPositiveInt(formData.get("appointmentId"));
    const file = formData.get("attachment");

    if (!(file instanceof File) || file.size <= 0) {
      return Response.json({ error: "Selecione um arquivo para anexar." }, { status: 400 });
    }

    if (!draftKey) {
      return Response.json({ error: "draftKey não informado." }, { status: 400 });
    }

    await uploadDraftAttachment({
      appointmentId,
      authorUserId: auth.user.id,
      draftKey,
      file,
      noteType,
      patientId,
    });

    return Response.json(
      await listPatientAttachments({
        authorUserId: auth.user.id,
        draftKey,
        patientId,
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao processar anexo.",
      },
      { status: 400 },
    );
  }
}
