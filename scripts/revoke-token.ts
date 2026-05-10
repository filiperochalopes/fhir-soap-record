#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

try {
  process.loadEnvFile?.();
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function formatDate(date: Date | null) {
  if (!date) return "never";
  return date.toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. Create a .env file or export DATABASE_URL before running the CLI.",
    );
  }

  const { revokeToken } = await import("../app/lib/auth.server");
  const { prisma } = await import("../app/lib/prisma.server");

  let tokenIdStr = readArg("--tokenId");

  if (!tokenIdStr) {
    if (!input.isTTY || !output.isTTY) {
      throw new Error("Missing required argument --tokenId. Pass --tokenId <id>.");
    }

    const terminal = createInterface({ input, output });
    try {
      const tokens = await prisma.authToken.findMany({
        where: { isActive: true, revokedAt: null },
        include: { user: true },
        orderBy: { id: "asc" },
      });

      if (tokens.length === 0) {
        throw new Error("No active tokens found.");
      }

      console.log("");
      console.log("Active tokens:");
      for (const t of tokens) {
        console.log(
          `  [${t.id}] User: ${t.user.fullName} (${t.user.crm}/${t.user.crmUf}) — created: ${formatDate(t.createdAt)} — last used: ${formatDate(t.lastUsedAt)}`,
        );
      }
      console.log("");

      tokenIdStr = await terminal.question("Token ID to revoke: ");

      const tokenIdParsed = parseInt(tokenIdStr, 10);
      if (isNaN(tokenIdParsed) || tokenIdParsed <= 0) {
        throw new Error(`Invalid token ID: ${tokenIdStr}`);
      }

      const chosen = tokens.find((t) => t.id === tokenIdParsed);
      if (!chosen) {
        throw new Error(`Token with ID ${tokenIdParsed} not found or already revoked.`);
      }

      console.log("");
      console.log(
        `Revoking token [${chosen.id}] for ${chosen.user.fullName} (${chosen.user.crm}/${chosen.user.crmUf})`,
      );
      const confirm = await terminal.question("Confirm? (y/N): ");
      if (confirm.trim().toLowerCase() !== "y") {
        console.log("Aborted.");
        return;
      }
    } finally {
      terminal.close();
    }
  }

  const tokenId = parseInt(tokenIdStr, 10);
  if (isNaN(tokenId) || tokenId <= 0) {
    throw new Error(`Invalid token ID: ${tokenIdStr}`);
  }

  const token = await prisma.authToken.findUnique({
    where: { id: tokenId },
    include: { user: true },
  });

  if (!token) {
    throw new Error(`Token with ID ${tokenId} not found.`);
  }
  if (!token.isActive || token.revokedAt) {
    throw new Error(`Token with ID ${tokenId} is already revoked.`);
  }

  await revokeToken(tokenId);

  console.log("");
  console.log("Token revoked");
  console.log(`Token ID: ${token.id}`);
  console.log(`User: ${token.user.fullName} (${token.user.crm}/${token.user.crmUf})`);
  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Could not revoke token");
  process.exit(1);
});
