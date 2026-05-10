import { HumanMessage, SystemMessage, isToolMessage } from "@langchain/core/messages";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getDefaultChatModel } from "~/lib/ai/provider.server";
import type { AnonymizedPayload } from "~/lib/soap-plugins/anonymize";

export type ToolCallResult = {
  toolName: string;
  toolCallId: string;
  raw: unknown;
};

const SYSTEM_PROMPT = `Você é um assistente clínico de suporte à estratificação de risco.
Receberá dados clínicos anonimizados (idade textual, sexo, texto livre do SOAP atual e/ou histórico).

## Regras obrigatórias

- **Nunca** emita recomendações terapêuticas, condutas ou prescrições.
- **Nunca** invente ou estime valores clínicos não mencionados.
- Sua função é **apenas apresentar e interpretar os scores retornados pelas tools**.

## Execução

1. Extraia do texto SOAP todos os valores clínicos mencionados (peso, altura, PA, glicose, lípides, HbA1c, TFG, tabagismo, etc.), mesmo em formato narrativo.
2. Chame todas as tools disponíveis com os dados extraídos.
3. Para cada tool, inspecione os campos \`status\`, \`resultado\`, \`faltantes\` e \`avisos\` da resposta.
   - Uma resposta com \`faltantes\` preenchido é **resultado válido e esperado** — significa que o score foi parcialmente calculado ou que faltam variáveis. **Nunca** trate isso como "erro técnico".
   - Apenas considere erro real se a tool retornar uma exceção ou stack trace sem resultado algum.

## Formato da resposta (markdown GFM, em português)

Para **cada score calculado com sucesso**, apresente as seguintes subseções:

### [Nome do Score]

**Tabela Aspecto / Resultado** — uma linha por métrica principal retornada pelo score.

| Aspecto | Resultado |
|---|---|
| ... | ... |

**Fatores agravantes identificados** (se a tool retornou — liste como bullet points em negrito com descrição).

**Achados laboratoriais relevantes** (se a tool retornou — liste como bullet points).

**Interpretação clínica** — 2-3 frases explicando o significado do resultado, sem recomendações.

---

Se houver \`faltantes\` em alguma tool (score incompleto), adicione ao final:

## Informações adicionais solicitadas

Para cada score com dados faltantes, liste perguntas objetivas em linguagem clínica:
- "Qual o peso atual em kg?" (em vez de "peso_kg ausente")
- Agrupe por score quando houver mais de um com pendências.`.trim();

export type AgentResult = {
  narrative: string;
  toolResults: ToolCallResult[];
};

export async function runCalcMcpAgent(payload: AnonymizedPayload): Promise<AgentResult> {
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

    // Collect all tool responses for debug
    const toolResults: ToolCallResult[] = result.messages
      .filter(isToolMessage)
      .map((msg) => {
        let raw: unknown = msg.content;
        if (typeof msg.content === "string") {
          try {
            raw = JSON.parse(msg.content);
          } catch {
            raw = msg.content;
          }
        }
        return {
          toolName: msg.name ?? "unknown",
          toolCallId: msg.tool_call_id,
          raw,
        };
      });

    const last = result.messages[result.messages.length - 1];
    if (!last) {
      return { narrative: "", toolResults };
    }

    const narrative =
      typeof last.content === "string"
        ? last.content
        : last.content
            .map((part) =>
              typeof part === "string"
                ? part
                : "text" in part && typeof part.text === "string"
                  ? part.text
                  : "",
            )
            .join("\n")
            .trim();

    return { narrative, toolResults };
  } finally {
    await client.close();
  }
}
