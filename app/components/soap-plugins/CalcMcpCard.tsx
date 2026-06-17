import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useFetcher } from "react-router";
import remarkGfm from "remark-gfm";

import { DebugJsonModal } from "~/components/soap-plugins/DebugJsonModal";
import { PluginCard } from "~/components/soap-plugins/PluginCard";
import { SegmentedControl } from "~/components/soap-plugins/SegmentedControl";
import { loadEncryptedDraft, migratePlainSessionDraft } from "~/lib/encrypted-draft-storage";
import type { ToolCallResult } from "~/lib/ai/mcp.server";
import type { CalcMcpTool } from "~/routes/app.patients.$patientId.soap-plugins.calc-mcp-tools";
import type { SoapPluginCardProps } from "~/lib/soap-plugins/types";
import { formatPatientAge } from "~/lib/utils";

type Scope = "current" | "current_history";

type CalcMcpResponse = {
  narrative?: string;
  toolResults?: ToolCallResult[];
  request?: unknown;
  error?: string;
};

type ToolsResponse = {
  tools: CalcMcpTool[];
};

type SoapDraftSnapshot = Record<string, string> & {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
};

async function readDraft(storageKey: string) {
  return (
    (await loadEncryptedDraft<SoapDraftSnapshot>(storageKey)) ??
    (await migratePlainSessionDraft<SoapDraftSnapshot>(storageKey))
  );
}

// ── Play icon ────────────────────────────────────────────────────────────────
function PlayIcon() {
  return (
    <svg fill="currentColor" height="10" viewBox="0 0 10 12" width="10" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0L10 6L0 12V0Z" />
    </svg>
  );
}

// ── Curly braces debug icon ───────────────────────────────────────────────────
function CurlyBracesIcon() {
  return (
    <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.5 5H9a2 2 0 0 0-2 2v2c0 1-.6 3-3 3 1 0 3 .6 3 3v2a2 2 0 0 0 2 2h.5m5-14h.5a2 2 0 0 1 2 2v2c0 1 .6 3 3 3-1 0-3 .6-3 3v2a2 2 0 0 1-2 2h-.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

// ── Individual tool subcard ────────────────────────────────────────────────────
function ToolSubcard(props: {
  tool: CalcMcpTool;
  patientId: number;
  scope: Scope;
  draftStorageKey: string;
  soapNoteCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CalcMcpResponse | null>(null);

  const narrative = result?.narrative ?? null;
  const toolResults = result?.toolResults ?? null;
  const requestData = result?.request ?? null;
  const error = result?.error ?? null;
  const hasToolResults = Boolean(toolResults?.length);
  const hasResult = narrative !== null || error !== null || hasToolResults;

  // Auto-expand when result arrives
  useEffect(() => {
    if (hasResult) setOpen(true);
  }, [hasResult]);

  async function handleRun() {
    const draft = (await readDraft(props.draftStorageKey)) ?? {};
    const formData = new FormData();
    formData.set("toolName", props.tool.name);
    formData.set("toolTitle", props.tool.title);
    formData.set("scope", props.scope);
    formData.set("subjective", draft.subjective ?? "");
    formData.set("objective", draft.objective ?? "");
    formData.set("assessment", draft.assessment ?? "");
    formData.set("plan", draft.plan ?? "");

    setIsRunning(true);
    setResult(null);
    setDebugOpen(false);
    try {
      const response = await fetch(`/patients/${props.patientId}/soap-plugins/calc-mcp`, {
        body: formData,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setResult({ error: "Resposta inesperada ao executar a calculadora." });
        return;
      }
      setResult((await response.json()) as CalcMcpResponse);
    } catch (error) {
      setResult({
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar a calculadora.",
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--panel-border)] bg-white/30 dark:bg-slate-900/30">
      {/* Compact header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-sm font-medium" title={props.tool.description}>
          {props.tool.title}
        </span>

        {hasResult && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--panel-border)] text-[color:var(--muted)] transition hover:opacity-70"
            onClick={() => setOpen((v) => !v)}
            title={open ? "Recolher resultado" : "Expandir resultado"}
            type="button"
          >
            <svg fill="none" height="8" viewBox="0 0 12 8" width="12" xmlns="http://www.w3.org/2000/svg">
              <path
                d={open ? "M10.59.59L6 5.17 1.41.59 0 2l6 6 6-6-1.41-1.41z" : "M1.41 7.41L6 2.83l4.59 4.58L12 6 6 0 0 6l1.41 1.41z"}
                fill="currentColor"
                fillOpacity="0.54"
              />
            </svg>
          </button>
        )}

        <button
          className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
          disabled={isRunning}
          onClick={handleRun}
          title={`Executar ${props.tool.title}`}
          type="button"
        >
          {isRunning ? (
            <svg className="animate-spin" fill="none" height="12" viewBox="0 0 24 24" width="12">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" />
            </svg>
          ) : (
            <PlayIcon />
          )}
        </button>
      </div>

      {/* Collapsible result */}
      {open && hasResult && (
        <div className="border-t border-[color:var(--panel-border)] px-4 pb-4 pt-3">
          {error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}

          {narrative ? (
            <div className="relative">
              {toolResults ? (
                <button
                  aria-label="Ver JSON de debug"
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                  onClick={() => setDebugOpen(true)}
                  title="Ver JSON de debug"
                  type="button"
                >
                  <CurlyBracesIcon />
                </button>
              ) : null}
              <div className="mcp-result rounded-xl border border-emerald-500/15 bg-white/45 p-4 dark:bg-slate-950/30">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
              </div>
            </div>
          ) : null}

          {!error && !narrative && hasToolResults ? (
            <div className="relative">
              <button
                aria-label="Ver JSON de debug"
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                onClick={() => setDebugOpen(true)}
                title="Ver JSON de debug"
                type="button"
              >
                <CurlyBracesIcon />
              </button>
              <p className="rounded-xl border border-emerald-500/15 bg-white/45 p-4 pr-12 text-sm dark:bg-slate-950/30">
                Resultado calculado. Abra o JSON de debug para ver o retorno bruto da tool.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {debugOpen && toolResults ? (
        <DebugJsonModal
          request={requestData}
          response={toolResults}
          onClose={() => setDebugOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function CalcMcpCard(props: SoapPluginCardProps) {
  const toolsFetcher = useFetcher<ToolsResponse>();
  const [scope, setScope] = useState<Scope>("current");

  const ageLabel = formatPatientAge(props.patient.birthDate, { timeZone: props.timeZone });
  const ageReady = Boolean(ageLabel);

  // Load tool list on mount
  useEffect(() => {
    if (toolsFetcher.state === "idle" && !toolsFetcher.data) {
      toolsFetcher.load(`/patients/${props.patientId}/soap-plugins/calc-mcp-tools`);
    }
  }, []);

  const tools = toolsFetcher.data?.tools ?? [];
  const loadingTools = toolsFetcher.state !== "idle";

  return (
    <PluginCard
      description="Executa calculadoras médicas usando dados clínicos anonimizados do SOAP."
      label="SOAP Plugin"
      title="Calculadoras (MCP)"
      tone="emerald"
    >
      {!ageReady ? (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
          Idade indisponível. Cadastre a data de nascimento para calcular scores.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Scope toggle */}
          <div>
            <p className="field-label">Escopo dos dados</p>
            <SegmentedControl
              onChange={setScope}
              options={[
                { label: "SOAP atual", value: "current" },
                {
                  disabled: !props.soapNoteCount,
                  label: props.soapNoteCount ? "Atual + histórico" : "Atual + histórico (vazio)",
                  value: "current_history",
                },
              ]}
              tone="emerald"
              value={scope}
            />
          </div>

          {/* Tool subcards */}
          {loadingTools ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  className="h-12 animate-pulse rounded-2xl border border-[color:var(--panel-border)] bg-white/20"
                  key={i}
                />
              ))}
            </div>
          ) : tools.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              Nenhuma calculadora disponível no servidor MCP.
            </p>
          ) : (
            <div className="space-y-2">
              {tools.map((tool) => (
                <ToolSubcard
                  draftStorageKey={props.draftStorageKey}
                  key={tool.name}
                  patientId={props.patientId}
                  scope={scope}
                  soapNoteCount={props.soapNoteCount}
                  tool={tool}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </PluginCard>
  );
}
