import { Prisma } from "@prisma/client";

import { getAttachmentForDownload } from "~/lib/attachments.server";
import { getPluginCredential } from "~/lib/plugin-credentials.server";
import { prisma } from "~/lib/prisma.server";

import { meuExameRequest } from "./client.server";

const PLUGIN_ID = "meuexame";
const SUPPORTED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function requireAccessibleAttachment(input: {
  attachmentId: number;
  patientId: number;
  userId: number;
}) {
  const attachment = await prisma.clinicalAttachment.findFirst({
    where: {
      id: input.attachmentId,
      patientId: input.patientId,
      OR: [
        { status: "attached" },
        { authorUserId: input.userId, status: "draft" },
      ],
    },
  });
  if (!attachment) {
    throw new Error("Anexo não encontrado.");
  }
  return attachment;
}

async function requireToken(userId: number) {
  const token = await getPluginCredential(userId, PLUGIN_ID);
  if (!token) {
    throw new Error("Configure seu token do MeuExame em Configurações.");
  }
  return token;
}

export async function startMeuExameExecution(input: {
  attachmentId: number;
  patientId: number;
  userId: number;
}) {
  const attachment = await requireAccessibleAttachment(input);
  const existing = await prisma.attachmentPluginExecution.findUnique({
    where: {
      attachmentId_pluginId: {
        attachmentId: attachment.id,
        pluginId: PLUGIN_ID,
      },
    },
  });
  if (existing && existing.status !== "failed") {
    return existing;
  }
  if (!SUPPORTED_CONTENT_TYPES.has(attachment.contentType)) {
    throw new Error("Tipo de arquivo não suportado pelo MeuExame.");
  }

  const token = await requireToken(input.userId);
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    include: { identifier: true },
  });
  if (!patient) {
    throw new Error("Paciente não encontrado.");
  }
  if (!patient.birthDate) {
    throw new Error("Informe a data de nascimento antes de processar o exame.");
  }

  const downloaded = await getAttachmentForDownload({
    attachmentId: attachment.id,
    userId: input.userId,
  });
  if (!downloaded) {
    throw new Error("Não foi possível ler o anexo.");
  }

  const cpf = patient.identifier.find((identifier) =>
    identifier.system.toLowerCase().includes("cpf"),
  )?.value;
  const formData = new FormData();
  formData.set(
    "file",
    new File([downloaded.body], attachment.fileName, {
      type: attachment.contentType,
    }),
  );
  formData.set("external_patient_id", `Patient/${patient.id}`);
  formData.set("full_name", patient.name);
  formData.set("birth_date", patient.birthDate.toISOString().slice(0, 10));
  formData.set("source_attachment_id", String(attachment.id));
  if (cpf) {
    formData.set("cpf", cpf);
  }

  const idempotencyKey = existing
    ? `${attachment.id}:${attachment.sha256}:retry:${existing.updatedAt.getTime()}`
    : `${attachment.id}:${attachment.sha256}`;

  const pendingExecution = await prisma.attachmentPluginExecution.upsert({
    where: {
      attachmentId_pluginId: {
        attachmentId: attachment.id,
        pluginId: PLUGIN_ID,
      },
    },
    create: {
      attachmentId: attachment.id,
      pluginId: PLUGIN_ID,
      requestedByUserId: input.userId,
      status: "queued",
    },
    update: {
      completedAt: null,
      error: null,
      externalJobId: null,
      requestedByUserId: input.userId,
      result: Prisma.DbNull,
      status: "queued",
      summary: null,
    },
  });

  try {
    const { payload, response } = await meuExameRequest(
      "/api/v1/exam-jobs",
      token,
      {
        body: formData,
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      },
    );
    const jobId = typeof payload.job_id === "string" ? payload.job_id : null;
    if (!response.ok || !jobId) {
      throw new Error(
        typeof payload.detail === "string"
          ? payload.detail
          : "MeuExame recusou o arquivo.",
      );
    }

    return prisma.attachmentPluginExecution.update({
      where: { id: pendingExecution.id },
      data: {
        externalJobId: jobId,
        status: typeof payload.status === "string" ? payload.status : "queued",
      },
    });
  } catch (error) {
    await prisma.attachmentPluginExecution.update({
      where: { id: pendingExecution.id },
      data: {
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Falha ao iniciar o MeuExame.",
        externalJobId: null,
        status: "failed",
      },
    });
    throw error;
  }
}

export async function refreshMeuExameExecution(input: {
  attachmentId: number;
  patientId: number;
  userId: number;
}) {
  const attachment = await requireAccessibleAttachment(input);
  const execution = await prisma.attachmentPluginExecution.findUnique({
    where: {
      attachmentId_pluginId: {
        attachmentId: attachment.id,
        pluginId: PLUGIN_ID,
      },
    },
  });
  if (!execution) {
    throw new Error("Processamento não encontrado.");
  }
  if (!["queued", "processing"].includes(execution.status)) {
    return execution;
  }
  if (!execution.externalJobId) {
    return prisma.attachmentPluginExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        error: "O envio ao MeuExame não foi concluído. Tente novamente.",
        status: "failed",
      },
    });
  }

  const token = await requireToken(execution.requestedByUserId);
  const jobPath = encodeURIComponent(execution.externalJobId);
  const { payload: statusPayload, response: statusResponse } =
    await meuExameRequest(`/api/v1/exam-jobs/${jobPath}`, token);
  const status =
    typeof statusPayload.status === "string" ? statusPayload.status : null;
  if (!statusResponse.ok || !status) {
    throw new Error(
      typeof statusPayload.detail === "string"
        ? statusPayload.detail
        : "Falha ao consultar o processamento.",
    );
  }
  if (status === "failed") {
    return prisma.attachmentPluginExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        error:
          typeof statusPayload.error === "string"
            ? statusPayload.error
            : "Falha no processamento.",
        status: "failed",
      },
    });
  }
  if (status !== "completed") {
    return prisma.attachmentPluginExecution.update({
      where: { id: execution.id },
      data: { error: null, status },
    });
  }

  const { payload: result, response: resultResponse } = await meuExameRequest(
    `/api/v1/exam-jobs/${jobPath}/result`,
    token,
  );
  const document =
    typeof result.document === "object" && result.document
      ? (result.document as Record<string, unknown>)
      : null;
  const summary =
    document && typeof document.inline_text === "string"
      ? document.inline_text
      : null;
  if (!resultResponse.ok || !summary) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "Resultado inválido retornado pelo MeuExame.",
    );
  }

  return prisma.attachmentPluginExecution.update({
    where: { id: execution.id },
    data: {
      completedAt: new Date(),
      error: null,
      result: result as Prisma.InputJsonValue,
      status: "completed",
      summary,
    },
  });
}
