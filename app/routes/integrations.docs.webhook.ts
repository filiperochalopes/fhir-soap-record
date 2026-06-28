import {
  recordDocsWebhookEvent,
  verifyDocsWebhookSignature,
  verifyDocsWebhookToken,
} from "~/lib/plugins/docs/integration.server";

export async function action({ request }: { request: Request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  try {
    const verifiedToken = verifyDocsWebhookToken(token);
    const rawBody = await request.text();

    await verifyDocsWebhookSignature({
      rawBody,
      signature: request.headers.get("X-Docs-Signature"),
      userId: verifiedToken.userId,
    });

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    await recordDocsWebhookEvent({
      payload,
      token: verifiedToken,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível processar o webhook.",
      },
      { status: 400 },
    );
  }
}
