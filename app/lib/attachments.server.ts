import { randomUUID, createHash } from "node:crypto";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Prisma, PrismaClient } from "@prisma/client";

import { writeAuditLog } from "~/lib/audit.server";
import { env } from "~/lib/env.server";
import { prisma } from "~/lib/prisma.server";

type AttachmentClient = PrismaClient | Prisma.TransactionClient;

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

let s3Client: S3Client | null = null;
let bucketReady = false;

function requireStorageConfig() {
  if (
    !env.S3_BUCKET ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY ||
    !env.S3_ENDPOINT
  ) {
    throw new Error("S3 storage is not configured.");
  }

  return {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    region: env.S3_REGION,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
}

function getS3Client() {
  const config = requireStorageConfig();
  if (!s3Client) {
    s3Client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      region: config.region,
    });
  }

  return { bucket: config.bucket, client: s3Client };
}

async function ensureBucket() {
  const { bucket, client } = getS3Client();
  if (bucketReady) {
    return bucket;
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  bucketReady = true;
  return bucket;
}

function expiresIn(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export type AttachmentSummary = {
  id: number;
  fileName: string;
  contentType: string;
  byteSize: number;
  status: string;
  createdAt: Date;
  downloadUrl: string;
  noteKind: "draft" | "soap" | "narrative" | "unknown";
};

function toSummary(attachment: {
  byteSize: number;
  contentType: string;
  createdAt: Date;
  fileName: string;
  id: number;
  narrativeNoteId: number | null;
  soapNoteId: number | null;
  status: string;
}): AttachmentSummary {
  return {
    byteSize: attachment.byteSize,
    contentType: attachment.contentType,
    createdAt: attachment.createdAt,
    downloadUrl: `/attachments/${attachment.id}/download`,
    fileName: attachment.fileName,
    id: attachment.id,
    noteKind:
      attachment.status === "draft"
        ? "draft"
        : attachment.soapNoteId
          ? "soap"
          : attachment.narrativeNoteId
            ? "narrative"
            : "unknown",
    status: attachment.status,
  };
}

export async function getOrCreateEncounterDraft(input: {
  appointmentId?: number | null;
  authorUserId: number;
  draftKey: string;
  noteType: string;
  patientId: number;
}, db: AttachmentClient = prisma) {
  const draftKey = input.draftKey.trim();
  if (!draftKey) {
    throw new Error("draftKey is required.");
  }

  return db.encounterDraft.upsert({
    where: {
      patientId_authorUserId_draftKey: {
        authorUserId: input.authorUserId,
        draftKey,
        patientId: input.patientId,
      },
    },
    create: {
      appointmentId: input.appointmentId ?? null,
      authorUserId: input.authorUserId,
      draftKey,
      expiresAt: expiresIn(7),
      noteType: input.noteType,
      patientId: input.patientId,
    },
    update: {
      appointmentId: input.appointmentId ?? null,
      expiresAt: expiresIn(7),
      noteType: input.noteType,
      status: "active",
    },
  });
}

export async function uploadDraftAttachment(input: {
  appointmentId?: number | null;
  authorUserId: number;
  draftKey: string;
  file: File;
  noteType: string;
  patientId: number;
}) {
  if (input.file.size <= 0) {
    throw new Error("Arquivo vazio.");
  }

  if (input.file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Arquivo excede o limite de 20 MB.");
  }

  const contentType = input.file.type || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("Tipo de arquivo não permitido.");
  }

  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) {
    throw new Error("Paciente não encontrado.");
  }

  const draft = await getOrCreateEncounterDraft(input);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const bucket = await ensureBucket();
  const s3Key = `patients/${input.patientId}/drafts/${draft.id}/${randomUUID()}-${input.file.name || "attachment"}`;
  const { client } = getS3Client();

  await client.send(
    new PutObjectCommand({
      Body: buffer,
      Bucket: bucket,
      ContentType: contentType,
      Key: s3Key,
    }),
  );

  const attachment = await prisma.clinicalAttachment.create({
    data: {
      appointmentId: input.appointmentId ?? null,
      authorUserId: input.authorUserId,
      byteSize: input.file.size,
      contentType,
      draftId: draft.id,
      fileName: input.file.name || "attachment",
      patientId: input.patientId,
      s3Bucket: bucket,
      s3Key,
      sha256,
      status: "draft",
    },
  });

  await writeAuditLog(prisma, {
    action: "attachment.uploaded",
    category: "attachment",
    entityId: String(attachment.id),
    entityType: "ClinicalAttachment",
    metadata: {
      byteSize: attachment.byteSize,
      contentType: attachment.contentType,
      draftId: draft.id,
      fileName: attachment.fileName,
    } satisfies Prisma.JsonObject,
    userId: input.authorUserId,
  });

  return toSummary(attachment);
}

export async function listPatientAttachments(input: {
  authorUserId: number;
  draftKey?: string | null;
  patientId: number;
}) {
  const draft = input.draftKey?.trim()
    ? await prisma.encounterDraft.findUnique({
        where: {
          patientId_authorUserId_draftKey: {
            authorUserId: input.authorUserId,
            draftKey: input.draftKey.trim(),
            patientId: input.patientId,
          },
        },
      })
    : null;

  const [draftAttachments, attachedAttachments] = await Promise.all([
    draft
      ? prisma.clinicalAttachment.findMany({
          where: {
            draftId: draft.id,
            status: "draft",
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.clinicalAttachment.findMany({
      where: {
        patientId: input.patientId,
        status: "attached",
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return {
    attached: attachedAttachments.map(toSummary),
    draft: draftAttachments.map(toSummary),
  };
}

export async function removeDraftAttachment(input: {
  attachmentId: number;
  authorUserId: number;
  patientId: number;
}) {
  const attachment = await prisma.clinicalAttachment.findFirst({
    where: {
      authorUserId: input.authorUserId,
      id: input.attachmentId,
      patientId: input.patientId,
      status: "draft",
    },
  });

  if (!attachment) {
    throw new Error("Anexo não encontrado.");
  }

  const { client } = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: attachment.s3Bucket,
      Key: attachment.s3Key,
    }),
  );

  await prisma.clinicalAttachment.update({
    where: { id: attachment.id },
    data: { status: "removed" },
  });

  await writeAuditLog(prisma, {
    action: "attachment.removed",
    category: "attachment",
    entityId: String(attachment.id),
    entityType: "ClinicalAttachment",
    userId: input.authorUserId,
  });
}

export async function promoteDraftAttachments(input: {
  appointmentId?: number | null;
  authorUserId: number;
  draftKey?: string | null;
  narrativeNoteId?: number | null;
  patientId: number;
  soapNoteId?: number | null;
}, db: AttachmentClient = prisma) {
  const draftKey = input.draftKey?.trim();
  if (!draftKey) {
    return;
  }

  const draft = await db.encounterDraft.findUnique({
    where: {
      patientId_authorUserId_draftKey: {
        authorUserId: input.authorUserId,
        draftKey,
        patientId: input.patientId,
      },
    },
  });

  if (!draft) {
    return;
  }

  await db.clinicalAttachment.updateMany({
    where: {
      draftId: draft.id,
      status: "draft",
    },
    data: {
      appointmentId: input.appointmentId ?? draft.appointmentId,
      narrativeNoteId: input.narrativeNoteId ?? null,
      soapNoteId: input.soapNoteId ?? null,
      status: "attached",
    },
  });

  await db.encounterDraft.update({
    where: { id: draft.id },
    data: { status: "attached" },
  });
}

export async function getAttachmentForDownload(input: {
  attachmentId: number;
  userId: number;
}) {
  const attachment = await prisma.clinicalAttachment.findFirst({
    where: {
      id: input.attachmentId,
      OR: [
        { status: "attached" },
        {
          authorUserId: input.userId,
          status: "draft",
        },
      ],
    },
  });

  if (!attachment) {
    return null;
  }

  const { client } = getS3Client();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: attachment.s3Bucket,
      Key: attachment.s3Key,
    }),
  );

  if (!result.Body) {
    throw new Error("Arquivo não encontrado no storage.");
  }

  const bytes = await result.Body.transformToByteArray();
  return {
    attachment,
    body: Buffer.from(bytes),
  };
}

export async function getFhirAttachments(patientId?: number | null) {
  return prisma.clinicalAttachment.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      status: "attached",
    },
    include: {
      author: true,
      patient: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFhirAttachmentById(id: number) {
  return prisma.clinicalAttachment.findFirst({
    where: {
      id,
      status: "attached",
    },
    include: {
      author: true,
      patient: true,
    },
  });
}
