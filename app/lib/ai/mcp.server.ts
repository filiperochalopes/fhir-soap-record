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

const IMC_TOOL_GUIDANCE = `
## Orientações específicas — IMC

Após o cálculo, **sempre** informe o peso-alvo correspondente, usando os campos retornados pela tool:

- **Adulto** (\`criterio_classificacao: adulto_who\`) — use \`pesos_por_imc\`:
  - \`imc_18_5\` = limite inferior da eutrofia
  - \`imc_24_9\` = limite superior da eutrofia
  - \`imc_29_9\` = limite superior do sobrepeso (início da obesidade)
- **Pediátrico** (\`who_bmi_for_age_0_5_anos\` ou \`who_2007_bmi_for_age_5_19_anos\`) — use \`pesos_por_z_score\`:
  - \`z_score_neg_1\` = limite inferior da eutrofia (z = -1)
  - \`z_score_1\` = limite superior da eutrofia (z = +1)

## Formato de saída — IMC (sobrescreve o formato geral)

A resposta deve conter **exclusivamente** uma tabela Markdown Aspecto/Resultado. **Sem** título, **sem** seções "Interpretação clínica", "Fatores agravantes", "Achados laboratoriais", **sem** texto antes ou depois da tabela.

Linhas obrigatórias da tabela:
- IMC (valor numérico)
- Categoria
- Critério de classificação
- Z-Score (apenas se pediátrico)

Linha(s) de peso-alvo — **somente se a categoria não for eutrofia**:
- **Baixo peso**: adicione "Peso-alvo (eutrofia)" com o valor do limite inferior (\`imc_18_5\` em adulto, \`z_score_neg_1\` em pediátrico) e indique entre parênteses quantos kg precisam ser **ganhos**.
- **Sobrepeso**: adicione "Peso-alvo (eutrofia)" com o limite superior (\`imc_24_9\` em adulto, \`z_score_1\` em pediátrico) e os kg a **perder**.
- **Obesidade** (adulto): adicione **duas** linhas — "Peso-alvo (sair da obesidade)" usando \`imc_29_9\` e "Peso-alvo (eutrofia)" usando \`imc_24_9\`, ambas com os kg a perder.
- **Eutrofia**: **não** inclua linha de peso-alvo.
`.trim();

const PREVENT_TOOL_GUIDANCE = `
## Orientações específicas — risco cardiovascular PREVENT

Use estas regras quando a tool calcular risco cardiovascular PREVENT/AHA ou estratificação cardiovascular baseada no PREVENT.

## Formato de saída — PREVENT cardiovascular (sobrescreve o formato geral)

A resposta deve ser curta e objetiva. Não use as seções gerais "Fatores agravantes identificados", "Achados laboratoriais relevantes" ou "Interpretação clínica".

Se o score foi calculado, responda nesta ordem:

1. Uma tabela Markdown com estas colunas:

| Item | 5 anos | 10 anos | 30 anos | Observação |
|---|---:|---:|---:|---|

Linhas obrigatórias:
- **Risco PREVENT basal**: risco calculado pela tool antes de variáveis modificadoras, se a tool retornar esse valor. Se não retornar, use "Não retornado".
- **Variáveis modificadoras aplicadas**: liste somente as variáveis modificadoras efetivamente presentes/aplicadas. Se nenhuma, escreva "Nenhuma".
- **Risco cardiovascular final**: risco após variáveis modificadoras. Se for igual ao PREVENT basal, deixe isso explícito na observação.
- **Classificação final**: baixo/intermediário/alto ou a categoria retornada pela tool. Na observação, cite o racional em uma frase curta.

Regras para percentuais:
- Sempre que a tool retornar riscos em 5, 10 e 30 anos, mostre os três horizontes na tabela.
- Se a tool retornar risco basal e risco final em 5, 10 e 30 anos, mostre ambos.
- Se algum horizonte não for retornado, escreva "Não retornado"; não estime.

2. Abaixo da tabela, escreva **um parágrafo curto** explicando por que essa é a classificação final e o que os percentuais representam. Evite narrativa longa.

3. Se o risco final for diferente do risco PREVENT basal, escreva **uma frase curta** dizendo quais variáveis modificadoras mudaram o resultado. Se não mudou, omita essa frase.

4. Escreva **um segundo parágrafo curto**, somente se útil, com perguntas/dados que poderiam melhorar a avaliação. Priorize variáveis ausentes plausivelmente relevantes para esse paciente. Use linguagem clínica direta, não nomes técnicos de variáveis.

Se faltarem dados obrigatórios, use apenas:

## Informações adicionais solicitadas

Liste perguntas objetivas para permitir o cálculo do PREVENT. Inclua os horizontes de risco apenas depois de calculados.
`.trim();

function isPreventTool(toolName?: string, toolTitle?: string) {
  const text = `${toolName ?? ""} ${toolTitle ?? ""}`.toLowerCase();
  return (
    text.includes("prevent") ||
    text.includes("cardiovascular") ||
    text.includes("cardio") ||
    text.includes("ascvd")
  );
}

function buildSystemPrompt(toolName?: string, toolTitle?: string) {
  const base = `Você é um assistente clínico de suporte à estratificação de risco.

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

  const isImc = toolName === "imc" || toolName?.endsWith("__imc");
  if (isImc) {
    return `${base}\n\n${IMC_TOOL_GUIDANCE}`;
  }

  if (isPreventTool(toolName, toolTitle)) {
    return `${base}\n\n${PREVENT_TOOL_GUIDANCE}`;
  }

  return base;
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
        new SystemMessage(buildSystemPrompt(exposedToolName, input.toolTitle)),
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
