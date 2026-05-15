import { requireUserSession } from "~/lib/auth.server";

export type CalcMcpTool = {
  name: string;
  title: string;
  description: string;
};

type McpToolsListResponse = {
  result?: {
    tools?: Array<{
      name?: string;
      title?: string;
      description?: string;
    }>;
  };
};

export async function loader({ request }: { request: Request }) {
  await requireUserSession(request);

  const mcpUrl = process.env.MCP_CALC_URL?.trim() || "http://beta.calc.filipelopes.med.br/mcp";

  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Response("Falha ao listar tools do MCP", { status: 502 });
  }

  const data = (await res.json()) as McpToolsListResponse;

  const tools: CalcMcpTool[] = (data.result?.tools ?? []).map((t) => ({
    name: t.name ?? "",
    title: t.title ?? t.name ?? "",
    description: t.description ?? "",
  }));

  return Response.json({ tools });
}
