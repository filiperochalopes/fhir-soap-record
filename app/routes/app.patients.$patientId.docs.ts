import { redirect } from "react-router";

import { requireUserSession } from "~/lib/auth.server";
import {
  buildDocsLaunchUrl,
  type DocsDocumentType,
} from "~/lib/plugins/docs/integration.server";
import { prisma } from "~/lib/prisma.server";
import { env } from "~/lib/env.server";

const DOCUMENT_TYPES = new Set<DocsDocumentType>([
  "generic-document",
  "medical-certificate",
  "prescription",
  "service-request",
]);

export async function action({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  const auth = await requireUserSession(request);
  const formData = await request.formData();
  const documentType = String(formData.get("documentType") ?? "");

  if (!DOCUMENT_TYPES.has(documentType as DocsDocumentType)) {
    throw new Response("Tipo de documento inválido.", { status: 400 });
  }

  const patient = await prisma.patient.findUnique({
    where: { id: Number(params.patientId) },
    include: { identifier: true },
  });

  if (!patient) {
    throw new Response("Paciente não encontrado.", { status: 404 });
  }

  const webhookBaseUrl = env.DOCS_WEBHOOK_BASE_URL ?? env.DOCS_APP_BASE_URL;
  if (!webhookBaseUrl) {
    throw new Response("Integração Docs não configurada no servidor.", {
      status: 503,
    });
  }

  const url = await buildDocsLaunchUrl({
    appBaseUrl: env.APP_URL,
    documentType: documentType as DocsDocumentType,
    patient,
    webhookBaseUrl,
    userId: auth.user.id,
  });

  throw redirect(url);
}
