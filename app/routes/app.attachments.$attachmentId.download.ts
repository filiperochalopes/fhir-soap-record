import { requireUserSession } from "~/lib/auth.server";
import { getAttachmentForDownload } from "~/lib/attachments.server";

export async function loader({
  params,
  request,
}: {
  params: { attachmentId?: string };
  request: Request;
}) {
  const auth = await requireUserSession(request);

  const attachmentId = Number(params.attachmentId);
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new Response("Attachment not found", { status: 404 });
  }

  const result = await getAttachmentForDownload({
    attachmentId,
    userId: auth.user.id,
  });
  if (!result) {
    throw new Response("Attachment not found", { status: 404 });
  }

  const contentDisposition =
    result.attachment.contentType === "application/pdf"
      ? "inline"
      : "attachment";

  return new Response(result.body, {
    headers: {
      "Content-Disposition": `${contentDisposition}; filename="${result.attachment.fileName.replaceAll('"', "'")}"`,
      "Content-Length": String(result.attachment.byteSize),
      "Content-Type": result.attachment.contentType,
    },
  });
}
