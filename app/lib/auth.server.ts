import { randomBytes, createHash } from "node:crypto";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";

import { env } from "~/lib/env.server";
import { prisma } from "~/lib/prisma.server";
import { writeAuditLog } from "~/lib/audit.server";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type AuthContext = {
  tokenId: number;
  user: {
    id: number;
    fullName: string;
    crm: string;
    crmUf: string;
  };
};

export function createRawToken() {
  return `fsr_${randomBytes(24).toString("base64url")}`;
}

export function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildAuthCookie(rawToken: string) {
  return serializeCookie(env.COOKIE_NAME, rawToken, {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

export function clearAuthCookie() {
  return serializeCookie(env.COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

function getTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const cookies = parseCookie(request.headers.get("cookie") ?? "");
  return cookies[env.COOKIE_NAME];
}

export async function authenticateToken(rawToken: string | null | undefined) {
  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const authToken = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!authToken || !authToken.isActive || authToken.revokedAt || !authToken.user.isActive) {
    return null;
  }

  await prisma.authToken.update({
    where: { id: authToken.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    tokenId: authToken.id,
    user: {
      id: authToken.user.id,
      fullName: authToken.user.fullName,
      crm: authToken.user.crm,
      crmUf: authToken.user.crmUf,
    },
  } satisfies AuthContext;
}

export async function getAuthContext(request: Request) {
  const rawToken = getTokenFromRequest(request);
  return authenticateToken(rawToken);
}

export async function requireUserSession(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) {
    throw new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
      },
    });
  }

  return auth;
}

export async function requireApiUser(request: Request) {
  const auth = await getAuthContext(request);
  if (!auth) {
    throw new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "A valid Bearer token is required.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "Bearer",
        },
      },
    );
  }

  return auth;
}

export async function createUserToken(input: {
  crm: string;
  crmUf: string;
  fullName: string;
}) {
  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);

  const user = await prisma.authUser.create({
    data: {
      crm: input.crm,
      crmUf: input.crmUf,
      fullName: input.fullName,
      tokens: {
        create: {
          tokenHash,
        },
      },
    },
  });

  await writeAuditLog(prisma, {
    action: "auth.user.created",
    category: "auth",
    entityId: String(user.id),
    entityType: "AuthUser",
    userId: user.id,
  });

  return { rawToken, user };
}

export async function recordLoginAudit(auth: AuthContext) {
  await writeAuditLog(prisma, {
    action: "auth.token.used",
    category: "auth",
    entityId: String(auth.tokenId),
    entityType: "AuthToken",
    userId: auth.user.id,
  });
}
