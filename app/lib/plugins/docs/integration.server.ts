import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type { Identifier, Patient, Prisma } from "@prisma/client";

import { env } from "~/lib/env.server";
import { decodePluginSecretEncryptionKey } from "~/lib/plugin-secret-key.server";
import {
  getPluginCredential,
  hasPluginCredential,
  removePluginCredential,
  setPluginCredential,
} from "~/lib/plugin-credentials.server";
import { prisma } from "~/lib/prisma.server";

const PLUGIN_ID = "docs";
const CIPHER = "aes-256-gcm";
const PAYLOAD_VERSION = "v1";
const CREDENTIAL_VERSION = 1;

export type DocsDocumentType =
  | "generic-document"
  | "medical-certificate"
  | "prescription"
  | "service-request";

type DocsCredential = {
  apiKey: string;
  medicalCertificateTemplateId: string;
  version: number;
};

type DocsWebhookTokenPayload = {
  expiresAt: string;
  patientId: number;
  state: string;
  userId: number;
};

export type DocsWebhookSuggestion = {
  createdAt: Date;
  documentType: string;
  id: number;
  text: string;
};

function normalizeDocsBaseUrl() {
  if (!env.DOCS_APP_BASE_URL) {
    throw new Error("Integração Docs não configurada no servidor.");
  }

  return env.DOCS_APP_BASE_URL.replace(/\/+$/, "");
}

export function getDocsAppOrigin() {
  if (!env.DOCS_APP_BASE_URL) {
    return null;
  }

  return new URL(env.DOCS_APP_BASE_URL).origin;
}

function parseDocsCredential(raw: string | null): DocsCredential | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DocsCredential>;
    if (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
      return {
        apiKey: parsed.apiKey.trim(),
        medicalCertificateTemplateId:
          typeof parsed.medicalCertificateTemplateId === "string"
            ? parsed.medicalCertificateTemplateId.trim()
            : "",
        version:
          typeof parsed.version === "number" ? parsed.version : CREDENTIAL_VERSION,
      };
    }
  } catch {
    if (raw.trim()) {
      return {
        apiKey: raw.trim(),
        medicalCertificateTemplateId: "",
        version: CREDENTIAL_VERSION,
      };
    }
  }

  return null;
}

async function getCredential(userId: number) {
  return parseDocsCredential(await getPluginCredential(userId, PLUGIN_ID));
}

function webhookSigningKey() {
  if (!env.PLUGIN_SECRET_ENCRYPTION_KEY) {
    throw new Error("Plugin secret encryption is not configured.");
  }

  const key = decodePluginSecretEncryptionKey(env.PLUGIN_SECRET_ENCRYPTION_KEY);
  if (!key) {
    throw new Error("Plugin secret encryption key is invalid.");
  }

  return key;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signValue(value: string) {
  return createHmac("sha256", webhookSigningKey()).update(value).digest("base64url");
}

function createWebhookToken(payload: DocsWebhookTokenPayload) {
  const encoded = base64UrlJson(payload);
  return `${encoded}.${signValue(encoded)}`;
}

export function verifyDocsWebhookToken(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new Error("Token de webhook inválido.");
  }

  const expected = signValue(encoded);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Assinatura do token de webhook inválida.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as DocsWebhookTokenPayload;
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new Error("Token de webhook expirado.");
  }

  return payload;
}

export async function getDocsIntegrationSettings(userId: number) {
  const credential = await getCredential(userId);

  return {
    available: Boolean(env.DOCS_APP_BASE_URL),
    configured: Boolean(credential?.apiKey),
    medicalCertificateTemplateId: credential?.medicalCertificateTemplateId ?? "",
  };
}

export async function setDocsIntegrationSettings(input: {
  apiKey: string;
  medicalCertificateTemplateId: string;
  userId: number;
}) {
  const existing = await getCredential(input.userId);
  const apiKey = input.apiKey.trim() || existing?.apiKey || "";

  if (!apiKey) {
    throw new Error("Informe a API key do Docs.");
  }

  await setPluginCredential({
    pluginId: PLUGIN_ID,
    secret: JSON.stringify({
      apiKey,
      medicalCertificateTemplateId: input.medicalCertificateTemplateId.trim(),
      version: CREDENTIAL_VERSION,
    } satisfies DocsCredential),
    userId: input.userId,
  });
}

export async function removeDocsIntegrationSettings(userId: number) {
  if (!(await hasPluginCredential(userId, PLUGIN_ID))) {
    return;
  }

  await removePluginCredential({
    pluginId: PLUGIN_ID,
    userId,
  });
}

async function requireDocsCredential(userId: number) {
  const credential = await getCredential(userId);
  if (!credential?.apiKey) {
    throw new Error("Configure a API key do Docs em Configurações.");
  }

  return credential;
}

function normalizeSignatureHeader(value: string) {
  return value.trim().replace(/^sha256=/i, "");
}

export async function verifyDocsWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  userId: number;
}) {
  if (!input.signature) {
    throw new Error("Assinatura do webhook ausente.");
  }

  const credential = await requireDocsCredential(input.userId);
  const expected = createHmac("sha256", credential.apiKey)
    .update(input.rawBody, "utf8")
    .digest("hex");
  const received = normalizeSignatureHeader(input.signature);
  if (!/^[0-9a-fA-F]{64}$/.test(received)) {
    throw new Error("Formato de assinatura do webhook inválido.");
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error("Assinatura do webhook inválida.");
  }
}

function encryptionKey(apiKey: string) {
  return createHash("sha256").update(apiKey, "utf8").digest();
}

function encryptUrlValue(value: string, apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, encryptionKey(apiKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function patientIdentifierType(identifier: Identifier) {
  const normalized = identifier.system.toLowerCase();
  if (normalized.includes("cpf")) return "cpf";
  if (normalized.includes("cns")) return "cns";
  return identifier.system;
}

function documentRoute(type: DocsDocumentType) {
  if (type === "prescription") return "/prescription";
  if (type === "service-request") return "/solicitacao-exames";
  return "/relatorio";
}

function documentPayload(input: {
  credential: DocsCredential;
  documentType: DocsDocumentType;
}) {
  if (input.documentType !== "medical-certificate") {
    return { kind: input.documentType };
  }

  if (!input.credential.medicalCertificateTemplateId) {
    throw new Error("Configure o ID do template de atestado do Docs.");
  }

  return {
    kind: input.documentType,
    templateId: input.credential.medicalCertificateTemplateId,
    title: "Atestado Médico",
  };
}

function firstPatientIdentifier(
  identifiers: Identifier[],
  type: "cns" | "cpf",
) {
  return identifiers.find((identifier) => patientIdentifierType(identifier) === type)
    ?.value;
}

function encryptedSearchParams(
  params: Record<string, string | undefined>,
  apiKey: string,
) {
  return Object.entries(params).flatMap(([key, value]) => {
    const normalizedValue = value?.trim();
    return normalizedValue ? [[key, encryptUrlValue(normalizedValue, apiKey)] as const] : [];
  });
}

export async function buildDocsLaunchUrl(input: {
  documentType: DocsDocumentType;
  patient: Patient & { identifier: Identifier[] };
  appBaseUrl: string;
  webhookBaseUrl: string;
  userId: number;
}) {
  if (!input.patient.birthDate) {
    throw new Error("Informe a data de nascimento do paciente antes de gerar documentos.");
  }

  const credential = await requireDocsCredential(input.userId);
  const state = randomUUID();
  const appBaseUrl = input.appBaseUrl.replace(/\/+$/, "");
  const webhookBaseUrl = input.webhookBaseUrl.replace(/\/+$/, "");
  const webhookToken = createWebhookToken({
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    patientId: input.patient.id,
    state,
    userId: input.userId,
  });
  const document = documentPayload({
    credential,
    documentType: input.documentType,
  });
  const returnUrl = `${appBaseUrl}/patients/${input.patient.id}/soap`;
  const webhookUrl = `${webhookBaseUrl}/integrations/docs/webhook?token=${encodeURIComponent(
    webhookToken,
  )}`;

  const url = new URL(`${normalizeDocsBaseUrl()}${documentRoute(input.documentType)}`);
  url.searchParams.set("source", "fhir-soap-record");
  for (const [key, value] of encryptedSearchParams(
    {
      "document.kind": input.documentType,
      "document.templateId":
        typeof document.templateId === "string" ? document.templateId : undefined,
      "documentReference.title":
        typeof document.title === "string" ? document.title : undefined,
      "patient.birthDate": input.patient.birthDate.toISOString().slice(0, 10),
      "patient.cns": firstPatientIdentifier(input.patient.identifier, "cns"),
      "patient.cpf": firstPatientIdentifier(input.patient.identifier, "cpf"),
      "patient.name": input.patient.name,
      "return.mode": "postMessage",
      "return.url": returnUrl,
      state,
      templateId:
        typeof document.templateId === "string" ? document.templateId : undefined,
      "webhook.method": "POST",
      "webhook.url": webhookUrl,
    },
    credential.apiKey,
  )) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function clinicalNoteFromPayload(payload: Record<string, unknown>) {
  const direct =
    typeof payload.clinicalNote === "string"
      ? payload.clinicalNote
      : typeof payload.text === "string"
        ? payload.text
        : "";

  return direct.trim();
}

function documentTypeFromPayload(payload: Record<string, unknown>) {
  if (typeof payload.documentType === "string" && payload.documentType.trim()) {
    return payload.documentType.trim();
  }

  const document =
    typeof payload.document === "object" && payload.document
      ? (payload.document as Record<string, unknown>)
      : null;
  if (typeof document?.kind === "string" && document.kind.trim()) {
    return document.kind.trim();
  }

  return "document";
}

export async function recordDocsWebhookEvent(input: {
  payload: Record<string, unknown>;
  token: DocsWebhookTokenPayload;
}) {
  if (typeof input.payload.state === "string" && input.payload.state !== input.token.state) {
    throw new Error("Estado do webhook não confere.");
  }

  const clinicalNote = clinicalNoteFromPayload(input.payload);
  if (!clinicalNote) {
    throw new Error("Webhook sem conduta clínica.");
  }

  return prisma.clinicalDocumentWebhookEvent.upsert({
    where: { state: input.token.state },
    create: {
      authorUserId: input.token.userId,
      clinicalNote,
      documentType: documentTypeFromPayload(input.payload),
      patientId: input.token.patientId,
      payload: input.payload as Prisma.InputJsonObject,
      state: input.token.state,
    },
    update: {
      clinicalNote,
      consumedAt: null,
      documentType: documentTypeFromPayload(input.payload),
      payload: input.payload as Prisma.InputJsonObject,
    },
  });
}

export async function listPendingDocsWebhookSuggestions(input: {
  patientId: number;
  userId: number;
}) {
  const events = await prisma.clinicalDocumentWebhookEvent.findMany({
    where: {
      authorUserId: input.userId,
      consumedAt: null,
      patientId: input.patientId,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return events.map(
    (event): DocsWebhookSuggestion => ({
      createdAt: event.createdAt,
      documentType: event.documentType,
      id: event.id,
      text: event.clinicalNote,
    }),
  );
}

export async function consumeDocsWebhookSuggestion(input: {
  eventId: number;
  patientId: number;
  userId: number;
}) {
  await prisma.clinicalDocumentWebhookEvent.updateMany({
    where: {
      authorUserId: input.userId,
      consumedAt: null,
      id: input.eventId,
      patientId: input.patientId,
    },
    data: {
      consumedAt: new Date(),
    },
  });
}
