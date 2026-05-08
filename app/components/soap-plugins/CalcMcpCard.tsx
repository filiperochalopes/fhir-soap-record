import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useFetcher } from "react-router";
import remarkGfm from "remark-gfm";

import { formatPatientAge } from "~/lib/utils";
import type { SoapPluginCardProps } from "~/lib/soap-plugins/types";

type Scope = "current" | "current_history";

type CalcMcpResponse = {
  narrative?: string;
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
  const ageLabel = formatPatientAge(props.patient.birthDate, { timeZone: props.timeZone });
  const ageReady = Boolean(ageLabel);

  const isLoading = fetcher.state !== "idle";
  const narrative = fetcher.data?.narrative ?? null;
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
    <section className="panel p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
            SOAP Plugin
          </p>
          <h3 className="mt-2 text-2xl font-semibold">Calculadoras (MCP)</h3>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
            Envia dados anonimizados (idade e sexo, sem nome ou identificadores) ao servidor MCP de
            calculadoras médicas e retorna scores aplicáveis em narrativa curta.
          </p>
        </div>
      </div>

      {!ageReady ? (
        <p className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
          Idade indisponível, não é possível calcular scores. Cadastre a data de nascimento do
          paciente.
        </p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <fieldset className="space-y-2">
            <legend className="field-label">Escopo dos dados</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={scope === "current"}
                name="scope"
                onChange={() => setScope("current")}
                type="radio"
                value="current"
              />
              <span>SOAP atual em edição</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={scope === "current_history"}
                disabled={!props.soapNoteCount}
                name="scope"
                onChange={() => setScope("current_history")}
                type="radio"
                value="current_history"
              />
              <span>
                Atual + histórico
                {!props.soapNoteCount ? " (nenhum SOAP anterior)" : null}
              </span>
            </label>
          </fieldset>

          <div className="flex justify-end">
            <button className="button-primary" disabled={isLoading} type="submit">
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
        <div className="prose prose-sm dark:prose-invert mt-6 max-w-none rounded-2xl border border-violet-500/15 bg-white/45 p-4 dark:bg-slate-950/30">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}
