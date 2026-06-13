import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "~/lib/env.server";
import { prisma } from "~/lib/prisma.server";

const CIPHER = "aes-256-gcm";
const VERSION = "v1";

function encryptionKey() {
  if (!env.PLUGIN_SECRET_ENCRYPTION_KEY) {
    throw new Error("Plugin secret encryption is not configured.");
  }

  const key = Buffer.from(env.PLUGIN_SECRET_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("Plugin secret encryption key is invalid.");
  }
  return key;
}

export function encryptPluginSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptPluginSecret(payload: string) {
  const [version, ivValue, tagValue, ciphertextValue] = payload.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored plugin credential is invalid.");
  }

  const decipher = createDecipheriv(
    CIPHER,
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function hasPluginCredential(userId: number, pluginId: string) {
  return Boolean(
    await prisma.userPluginCredential.findUnique({
      where: { userId_pluginId: { pluginId, userId } },
      select: { id: true },
    }),
  );
}

export async function getPluginCredential(userId: number, pluginId: string) {
  const credential = await prisma.userPluginCredential.findUnique({
    where: { userId_pluginId: { pluginId, userId } },
  });
  return credential ? decryptPluginSecret(credential.encryptedSecret) : null;
}

export async function setPluginCredential(input: {
  pluginId: string;
  secret: string;
  userId: number;
}) {
  const secret = input.secret.trim();
  if (!secret) {
    throw new Error("Informe o token do plugin.");
  }

  const pending = await prisma.attachmentPluginExecution.count({
    where: {
      pluginId: input.pluginId,
      requestedByUserId: input.userId,
      status: { in: ["queued", "processing"] },
    },
  });
  if (pending) {
    throw new Error("Aguarde a conclusão dos processamentos pendentes.");
  }

  return prisma.userPluginCredential.upsert({
    where: {
      userId_pluginId: {
        pluginId: input.pluginId,
        userId: input.userId,
      },
    },
    create: {
      encryptedSecret: encryptPluginSecret(secret),
      pluginId: input.pluginId,
      userId: input.userId,
    },
    update: {
      encryptedSecret: encryptPluginSecret(secret),
    },
  });
}

export async function removePluginCredential(input: {
  pluginId: string;
  userId: number;
}) {
  const pending = await prisma.attachmentPluginExecution.count({
    where: {
      pluginId: input.pluginId,
      requestedByUserId: input.userId,
      status: { in: ["queued", "processing"] },
    },
  });
  if (pending) {
    throw new Error("Aguarde a conclusão dos processamentos pendentes.");
  }

  await prisma.userPluginCredential.deleteMany({
    where: {
      pluginId: input.pluginId,
      userId: input.userId,
    },
  });
}
