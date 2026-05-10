import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useFetcher } from "react-router";
import remarkGfm from "remark-gfm";

import { DebugJsonModal } from "~/components/soap-plugins/DebugJsonModal";
import { PluginCard } from "~/components/soap-plugins/PluginCard";
import { SegmentedControl } from "~/components/soap-plugins/SegmentedControl";
import type { ToolCallResult } from "~/lib/ai/mcp.server";
import type { SoapPluginCardProps } from "~/lib/soap-plugins/types";
import { formatPatientAge } from "~/lib/utils";

type Scope = "current" | "current_history";

type CalcMcpResponse = {
  narrative?: string;
  toolResults?: ToolCallResult[];
  request?: unknown;
  error?: string;
};

function readDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
    };
  } catch {
    return null;
  }
}

export function CalcMcpCard(props: SoapPluginCardProps) {
  const fetcher = useFetcher<CalcMcpResponse>();
  const [scope, setScope] = useState<Scope>("current");
  const [debugOpen, setDebugOpen] = useState(false);
  const ageLabel = formatPatientAge(props.patient.birthDate, { timeZone: props.timeZone });
  const ageReady = Boolean(ageLabel);

  const isLoading = fetcher.state !== "idle";
  const narrative = fetcher.data?.narrative ?? null;
  const toolResults = fetcher.data?.toolResults ?? null;
  const requestPayload = fetcher.data?.request ?? null;
  const error = fetcher.data?.error ?? null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = readDraft(props.draftStorageKey) ?? {};
    const formData = new FormData();
    formData.set("scope", scope);
    formData.set("subjective", draft.subjective ?? "");
    formData.set("objective", draft.objective ?? "");
    formData.set("assessment", draft.assessment ?? "");
    formData.set("plan", draft.plan ?? "");
    fetcher.submit(formData, {
      action: `/patients/${props.patientId}/soap-plugins/calc-mcp`,
      method: "post",
    });
  }

  return (
    <>
      <PluginCard
        description="Envia dados anonimizados (idade e sexo, sem nome ou identificadores) ao servidor MCP de calculadoras médicas e retorna scores aplicáveis em narrativa curta."
        label="SOAP Plugin"
        title="Calculadoras (MCP)"
        tone="emerald"
      >
        {!ageReady ? (
          <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
            Idade indisponível, não é possível calcular scores. Cadastre a data de nascimento do
            paciente.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <p className="field-label">Escopo dos dados</p>
              <SegmentedControl
                onChange={setScope}
                options={[
                  { label: "SOAP atual", value: "current" },
                  {
                    disabled: !props.soapNoteCount,
                    label: props.soapNoteCount
                      ? "Atual + histórico"
                      : "Atual + histórico (vazio)",
                    value: "current_history",
                  },
                ]}
                tone="emerald"
                value={scope}
              />
            </div>

            <div className="flex justify-end">
              <button className="button-tonal-emerald" disabled={isLoading} type="submit">
                {isLoading ? "Executando..." : "Executar"}
              </button>
            </div>
          </form>
        )}

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        {narrative ? (
          <div className="relative mt-6">
            {/* Debug button */}
            {toolResults ? (
              <button
                aria-label="Ver JSON de debug"
                className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                onClick={() => setDebugOpen(true)}
                title="Ver JSON de debug"
                type="button"
              >
                <svg fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.5 5H9a2 2 0 0 0-2 2v2c0 1-.6 3-3 3 1 0 3 .6 3 3v2a2 2 0 0 0 2 2h.5m5-14h.5a2 2 0 0 1 2 2v2c0 1 .6 3 3 3-1 0-3 .6-3 3v2a2 2 0 0 1-2 2h-.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </svg>
              </button>
            ) : null}

            <div className="mcp-result rounded-2xl border border-emerald-500/15 bg-white/45 p-5 dark:bg-slate-950/30">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </PluginCard>

      {debugOpen && toolResults ? (
        <DebugJsonModal
          request={requestPayload}
          response={toolResults}
          onClose={() => setDebugOpen(false)}
        />
      ) : null}
    </>
  );
}
