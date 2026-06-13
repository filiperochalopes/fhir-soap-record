import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";

import type {
  AttachmentPluginActionProps,
  AttachmentPluginExecutionSummary,
} from "~/lib/attachment-plugins/types";

type PluginActionResponse = {
  error?: string;
  execution?: AttachmentPluginExecutionSummary;
};

export function MeuExameAttachmentAction(
  props: AttachmentPluginActionProps,
) {
  const fetcher = useFetcher<PluginActionResponse>();
  const [execution, setExecution] = useState(props.execution);
  const [copied, setCopied] = useState(false);
  const action = `/patients/${props.patientId}/attachments/${props.attachment.id}/plugins/${props.plugin.id}`;
  const pending = ["queued", "processing"].includes(execution?.status ?? "");

  useEffect(() => {
    setExecution(props.execution);
  }, [props.execution]);

  useEffect(() => {
    if (!fetcher.data?.execution) {
      return;
    }
    setExecution(fetcher.data.execution);
    props.onExecutionChange(fetcher.data.execution);
  }, [fetcher.data]);

  useEffect(() => {
    if (!pending || fetcher.state !== "idle") {
      return;
    }
    const timeout = window.setTimeout(() => {
      const formData = new FormData();
      formData.set("intent", "refresh");
      fetcher.submit(formData, { action, method: "post" });
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [action, fetcher, pending]);

  async function copySummary() {
    if (!execution?.summary) {
      return;
    }
    await navigator.clipboard.writeText(execution.summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function start() {
    const formData = new FormData();
    formData.set("intent", "start");
    fetcher.submit(formData, { action, method: "post" });
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
          disabled={fetcher.state !== "idle"}
          onClick={start}
          type="button"
        >
          {fetcher.state !== "idle"
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

      {fetcher.data?.error || execution?.error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs">
          {fetcher.data?.error ?? execution?.error}
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
