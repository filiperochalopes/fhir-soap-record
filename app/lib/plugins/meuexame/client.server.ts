import { env } from "~/lib/env.server";

function baseUrl() {
  if (!env.MEUEXAME_API_BASE_URL) {
    throw new Error("Plugin MeuExame não está disponível.");
  }
  return env.MEUEXAME_API_BASE_URL.replace(/\/+$/, "");
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export async function meuExameRequest(
  path: string,
  token: string,
  init?: RequestInit,
) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  return {
    payload: await parseResponse(response),
    response,
  };
}
