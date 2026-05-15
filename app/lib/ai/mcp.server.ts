import { HumanMessage, SystemMessage, isToolMessage } from "@langchain/core/messages";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import { getDefaultChatModel } from "~/lib/ai/provider.server";

export type ToolCallResult = {
  toolName: string;
  toolCallId: string;
  raw: unknown;
};

export type AgentResult = {
  narrative: string;
  toolResults: ToolCallResult[];
};

function buildSystemPrompt() {
  return `Você é um assistente clínico de suporte à estratificação de risco.

## Regras obrigatórias

- **Nunca** emita recomendações terapêuticas, condutas ou prescrições.
- **Nunca** invente ou estime valores clínicos não mencionados no texto do paciente.
- Sua função é **extrair os dados presentes no texto, chamar a tool indicada e interpretar o resultado**.
- Omita campos opcionais ausentes — não os invente.
- Se faltar campo **obrigatório** para calcular: **não chame a tool**; responda apenas com a seção "Informações adicionais solicitadas".

## Inferências operacionais permitidas para inputs booleanos

- Para campos obrigatórios de resposta **sim/não**, quando a informação não estiver citada no SOAP, histórico, problemas, medicações ou exames, considere **não/falso** em vez de solicitar confirmação.
- Se a pergunta for sobre uso atual de medicação ou classe medicamentosa (ex.: estatina) e ela não aparecer na lista de medicações em uso nem no texto clínico, preencha como **não/falso**.
- Para diabetes mellitus, se não houver diagnóstico explícito, mas houver HbA1c **>= 6,5%**, use diabetes **sim/verdadeiro** para fins do cálculo e informe na interpretação que esse preenchimento foi inferido pelo valor de HbA1c.
- Não use essas regras para inventar valores numéricos, datas, medidas antropométricas, pressão arterial ou exames laboratoriais ausentes.

## Formato da resposta (markdown GFM, em português)

### Se o score foi calculado:

**Tabela Aspecto / Resultado** — uma linha por métrica principal:

| Aspecto | Resultado |
|---|---|
| ... | ... |

**Fatores agravantes identificados** (se presentes — bullet points em negrito + descrição).

**Achados laboratoriais relevantes** (se presentes — bullet points).

**Interpretação clínica** — 2-3 frases sobre o significado do resultado. Sem recomendações.

---

### Se faltar dados obrigatórios:

## Informações adicionais solicitadas

Liste perguntas clínicas objetivas para completar o cálculo. Não use nomes de variáveis técnicas (e.g. \`peso_kg\`) — use linguagem clínica direta:
- "Qual o peso atual do paciente em kg?"
- "Qual o valor de pressão arterial sistólica?"`.trim();
}

function buildUserMessage(toolName: string, toolTitle: string, soapText: string) {
  return `Por favor, calcule **${toolTitle}** usando a tool \`${toolName}\` com base no SOAP clínico anonimizado abaixo.

Extraia do texto os valores necessários e chame a tool. Se faltarem dados obrigatórios, não chame a tool — responda com "Informações adicionais solicitadas" listando o que precisa ser perguntado ao médico.

---

${soapText}`;
}

export async function runSingleToolAgent(input: {
  toolName: string;
  toolTitle: string;
  soapText: string;
  patientMeta: { ageLabel: string; sex: string };
}): Promise<AgentResult> {
  const model = getDefaultChatModel();
  if (!model) {
    throw new Error("LLM não configurado (LLM_TOKEN ausente)");
  }

  const mcpUrl = process.env.MCP_CALC_URL?.trim() || "http://beta.calc.filipelopes.med.br/mcp";

  const client = new MultiServerMCPClient({
    mcpServers: {
      calc: { transport: "http", url: mcpUrl },
    },
  });

  try {
    const allTools = await client.getTools();
    console.log("[mcp] available tool names:", allTools.map((t) => t.name));

    // LangChain prefixes tool names with the server key (e.g. "mcp__calc__imc").
    // Match by exact name or last "__"-delimited segment.
    const baseName = (n: string) => n.split("__").pop() ?? n;
    const tools = allTools.filter(
      (t) => t.name === input.toolName || baseName(t.name) === input.toolName,
    );
    if (!tools.length) {
      throw new Error(`Tool "${input.toolName}" não encontrada no servidor MCP.`);
    }

    // Use the LangChain-prefixed tool name in the user message so the LLM
    // references the exact function it has available.
    const exposedToolName = tools[0].name;
    console.log("[mcp] running agent with tool:", exposedToolName);

    const agent = createReactAgent({ llm: model, tools });

    const result = await agent.invoke({
      messages: [
        new SystemMessage(buildSystemPrompt()),
        new HumanMessage(buildUserMessage(exposedToolName, input.toolTitle, input.soapText)),
      ],
    });

    console.log(
      "[mcp] agent messages:",
      result.messages.map((m) => ({
        type: m.getType?.() ?? m.constructor.name,
        name: (m as { name?: string }).name,
        toolCalls: (m as { tool_calls?: unknown[] }).tool_calls?.length ?? 0,
        contentPreview:
          typeof m.content === "string" ? m.content.slice(0, 120) : "[non-string]",
      })),
    );

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
        return { toolName: msg.name ?? "unknown", toolCallId: msg.tool_call_id, raw };
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

    console.log("[mcp] narrative length:", narrative.length, "toolResults:", toolResults.length);
    return { narrative, toolResults };
  } finally {
    await client.close();
  }
}
