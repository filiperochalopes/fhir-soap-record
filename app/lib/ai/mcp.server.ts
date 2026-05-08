import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getDefaultChatModel } from "~/lib/ai/provider.server";
import type { AnonymizedPayload } from "~/lib/soap-plugins/anonymize";

const SYSTEM_PROMPT = [
  "Você é um assistente clínico que recebe dados anonimizados (idade textual, sexo, SOAP em edição e/ou histórico).",
  "Use as tools disponíveis no servidor MCP para calcular scores aplicáveis a partir desses dados.",
  "Liste apenas os scores que você conseguiu calcular com os dados disponíveis.",
  "Se faltarem variáveis para algum score, diga claramente o que faltou.",
  "Responda em português, com narrativa curta explicando os valores e a interpretação clínica.",
  "Quando útil, apresente uma tabela markdown com os resultados (use sintaxe GFM).",
  "Não invente valores nem reidentifique o paciente.",
].join(" ");

export async function runCalcMcpAgent(payload: AnonymizedPayload): Promise<string> {
  const model = getDefaultChatModel();
  if (!model) {
    throw new Error("LLM não configurado (LLM_TOKEN ausente)");
  }

  const mcpUrl = process.env.MCP_CALC_URL?.trim() || "http://beta.calc.filipelopes.med.br/mcp";

  const client = new MultiServerMCPClient({
    mcpServers: {
      calc: {
        transport: "http",
        url: mcpUrl,
      },
    },
  });

  try {
    const tools = await client.getTools();
    const agent = createReactAgent({ llm: model, tools });

    const result = await agent.invoke({
      messages: [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(JSON.stringify(payload, null, 2)),
      ],
    });

    const last = result.messages[result.messages.length - 1];
    if (!last) {
      return "";
    }

    if (typeof last.content === "string") {
      return last.content;
    }

    return last.content
      .map((part) =>
        typeof part === "string" ? part : "text" in part && typeof part.text === "string" ? part.text : "",
      )
      .join("\n")
      .trim();
  } finally {
    await client.close();
  }
}
