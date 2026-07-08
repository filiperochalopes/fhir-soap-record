import { useEffect, useState } from "react";
import { Link } from "react-router";

import type {
  AttachmentPluginActionProps,
  AttachmentPluginExecutionSummary,
} from "~/lib/attachment-plugins/types";

type PluginActionResponse = {
  error?: string;
  execution?: AttachmentPluginExecutionSummary;
};

const POLL_INTERVAL_MS = 2_500;

// Network failures here must never bubble to the route ErrorBoundary: this
// card polls in the background while the clinician is typing the SOAP note,
// so a dropped connection has to keep the screen alive and retry silently.
async function submitPluginIntent(action: string, intent: "refresh" | "start") {
  const formData = new FormData();
  formData.set("intent", intent);
  const response = await fetch(action, {
    body: formData,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    method: "POST",
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: "Resposta inesperada do servidor." } satisfies PluginActionResponse;
  }
  return (await response.json()) as PluginActionResponse;
}

export function MeuExameAttachmentAction(
  props: AttachmentPluginActionProps,
) {
  const [execution, setExecution] = useState(props.execution);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pollTick, setPollTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const action = `/patients/${props.patientId}/attachments/${props.attachment.id}/plugins/${props.plugin.id}`;
  const pending = ["queued", "processing"].includes(execution?.status ?? "");

  useEffect(() => {
    setExecution(props.execution);
  }, [props.execution]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const payload = await submitPluginIntent(action, "refresh");
        if (cancelled) {
          return;
        }
        if (payload.execution) {
          setRequestError(null);
          setExecution(payload.execution);
          props.onExecutionChange(payload.execution);
        } else if (payload.error) {
          setRequestError(payload.error);
        }
      } catch {
        // Falha de rede transitória: mantém o polling no próximo ciclo.
      } finally {
        if (!cancelled) {
          setPollTick((tick) => tick + 1);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [action, pending, pollTick]);

  async function copySummary() {
    if (!execution?.summary) {
      return;
    }
    await navigator.clipboard.writeText(execution.summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function start() {
    setSubmitting(true);
    setRequestError(null);
    try {
      const payload = await submitPluginIntent(action, "start");
      if (payload.execution) {
        setExecution(payload.execution);
        props.onExecutionChange(payload.execution);
      } else if (payload.error) {
        setRequestError(payload.error);
      }
    } catch {
      setRequestError(
        "Falha de conexão ao enviar para o MeuExame. Verifique a rede e tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!props.plugin.configured) {
    return (
      <p className="text-xs text-[color:var(--muted)]">
        MeuExame disponível.{" "}
        <Link className="font-medium underline" to="/settings">
          Configure seu token
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!execution || execution.status === "failed" ? (
        <button
          className="button-secondary"
          disabled={submitting}
          onClick={() => void start()}
          type="button"
        >
          {submitting
            ? "Enviando..."
            : execution
              ? "Tentar novamente no MeuExame"
              : "Processar no MeuExame"}
        </button>
      ) : null}

      {pending ? (
        <p className="text-xs font-medium text-violet-700 dark:text-violet-200">
          MeuExame: {execution?.status === "queued" ? "na fila" : "processando"}
        </p>
      ) : null}

      {requestError || execution?.error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs">
          {requestError ?? execution?.error}
        </p>
      ) : null}

      {execution?.summary ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="field-label">Resumo compacto</p>
            <button
              className="button-secondary px-3 py-1 text-xs"
              onClick={() => void copySummary()}
              type="button"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <textarea
            className="min-h-24 w-full select-text rounded-xl border border-[color:var(--panel-border)] bg-white/60 p-3 font-mono text-sm dark:bg-slate-950/50"
            readOnly
            value={execution.summary}
          />
        </div>
      ) : null}
    </div>
  );
}
