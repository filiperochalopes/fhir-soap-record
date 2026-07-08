import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router";

import { attachmentPlugins } from "~/lib/attachment-plugins/registry";
import type {
  AttachmentPluginExecutionSummary,
  AvailableAttachmentPlugin,
} from "~/lib/attachment-plugins/types";

type AttachmentSummary = {
  id: number;
  fileName: string;
  contentType: string;
  byteSize: number;
  status: string;
  createdAt: string;
  downloadUrl: string;
  noteKind: "draft" | "soap" | "narrative" | "unknown";
  pluginExecutions: AttachmentPluginExecutionSummary[];
};

type AttachmentsResponse = {
  attached: AttachmentSummary[];
  draft: AttachmentSummary[];
  error?: string;
  plugins: AvailableAttachmentPlugin[];
};

export type AttachmentsCardProps = {
  appointmentId: number | null;
  draftStorageKey: string;
  noteType: "narrative" | "soap";
  patientId: number;
};

const NETWORK_ERROR_MESSAGE =
  "Falha de conexão ao carregar os anexos. Verifique a rede e tente novamente.";

// Attachments requests run alongside the SOAP editor, so they use plain fetch
// with explicit error handling: a network failure in this card must never
// bubble to the route ErrorBoundary and unmount the clinical form.
async function parseAttachmentsResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { error: "Resposta inesperada do servidor." } as AttachmentsResponse;
  }
  return (await response.json()) as AttachmentsResponse;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentRow(props: {
  attachment: AttachmentSummary;
  canDelete?: boolean;
  onDelete?: (id: number) => void;
  onExecutionChange: (
    attachmentId: number,
    execution: AttachmentPluginExecutionSummary,
  ) => void;
  patientId: number;
  plugins: AvailableAttachmentPlugin[];
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--panel-border)] bg-white/30 px-3 py-3 text-sm dark:bg-slate-900/30">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <a
            className="block truncate font-medium hover:underline"
            href={props.attachment.downloadUrl}
            rel="noreferrer"
            target="_blank"
          >
            {props.attachment.fileName}
          </a>
          <p className="text-xs text-[color:var(--muted)]">
            {formatBytes(props.attachment.byteSize)} · {props.attachment.contentType}
          </p>
        </div>
        {props.canDelete ? (
          <button
            className="rounded-full border border-red-500/20 px-3 py-1 text-xs text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
            type="button"
            onClick={() => props.onDelete?.(props.attachment.id)}
          >
            Remover
          </button>
        ) : (
          <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-1 text-xs text-[color:var(--muted)]">
            {props.attachment.noteKind === "soap" ? "SOAP" : "Nota"}
          </span>
        )}
      </div>

      {(props.plugins ?? []).map((availablePlugin) => {
        if (
          !availablePlugin.supportedContentTypes.includes(
            props.attachment.contentType,
          )
        ) {
          return null;
        }
        const registeredPlugin = attachmentPlugins.find(
          (candidate) => candidate.id === availablePlugin.id,
        );
        if (!registeredPlugin) {
          return null;
        }
        const execution =
          props.attachment.pluginExecutions.find(
            (candidate) => candidate.pluginId === availablePlugin.id,
          ) ?? null;
        return (
          <registeredPlugin.Action
            attachment={props.attachment}
            execution={execution}
            key={availablePlugin.id}
            onExecutionChange={(nextExecution) =>
              props.onExecutionChange(props.attachment.id, nextExecution)
            }
            patientId={props.patientId}
            plugin={availablePlugin}
          />
        );
      })}
    </div>
  );
}

export function AttachmentsCard(props: AttachmentsCardProps) {
  const navigation = useNavigation();
  const previousNavigationState = useRef(navigation.state);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [responseData, setResponseData] = useState<AttachmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [executionOverrides, setExecutionOverrides] = useState<
    Record<string, AttachmentPluginExecutionSummary>
  >({});
  const attachmentsUrl = `/patients/${props.patientId}/attachments?draftKey=${encodeURIComponent(
    props.draftStorageKey,
  )}`;

  const refreshAttachments = useCallback(async () => {
    try {
      const response = await fetch(attachmentsUrl, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await parseAttachmentsResponse(response);
      if (payload.error) {
        setError(payload.error);
        return;
      }
      setError(null);
      setResponseData(payload);
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    }
  }, [attachmentsUrl]);

  useEffect(() => {
    void refreshAttachments();
  }, [refreshAttachments]);

  // Saving a note attaches the draft files server-side; reload the list when
  // a route navigation (e.g. the SOAP form POST + redirect) settles.
  useEffect(() => {
    if (previousNavigationState.current !== "idle" && navigation.state === "idle") {
      void refreshAttachments();
    }
    previousNavigationState.current = navigation.state;
  }, [navigation.state, refreshAttachments]);

  async function submitAttachmentForm(formData: FormData) {
    setIsUploading(true);
    try {
      const response = await fetch(`/patients/${props.patientId}/attachments`, {
        body: formData,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        method: "post",
      });
      const payload = await parseAttachmentsResponse(response);
      if (payload.error) {
        setError(payload.error);
        return;
      }
      setError(null);
      setResponseData(payload);
      setSelectedFile("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    } finally {
      setIsUploading(false);
    }
  }

  function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAttachmentForm(new FormData(event.currentTarget));
  }

  function deleteAttachment(id: number) {
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("attachmentId", String(id));
    formData.set("draftKey", props.draftStorageKey);
    void submitAttachmentForm(formData);
  }

  const withOverrides = (attachment: AttachmentSummary) => {
    const pluginExecutions = attachment.pluginExecutions ?? [];
    return {
      ...attachment,
      pluginExecutions: pluginExecutions
        .map(
          (execution) =>
            executionOverrides[`${attachment.id}:${execution.pluginId}`] ??
            execution,
        )
        .concat(
          Object.entries(executionOverrides)
            .filter(
              ([key, execution]) =>
                key.startsWith(`${attachment.id}:`) &&
                !pluginExecutions.some(
                  (current) => current.pluginId === execution.pluginId,
                ),
            )
            .map(([, execution]) => execution),
        ),
    };
  };
  const data = responseData
    ? {
        ...responseData,
        attached: (responseData.attached ?? []).map(withOverrides),
        draft: (responseData.draft ?? []).map(withOverrides),
        plugins: responseData.plugins ?? [],
      }
    : undefined;

  function setExecution(
    attachmentId: number,
    execution: AttachmentPluginExecutionSummary,
  ) {
    setExecutionOverrides((current) => ({
      ...current,
      [`${attachmentId}:${execution.pluginId}`]: execution,
    }));
  }

  return (
    <section className="panel space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-200">
          Core
        </p>
        <h3 className="mt-2 text-2xl font-semibold">Anexos</h3>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
          Anexa arquivos ao rascunho atual e vincula ao atendimento quando a nota for
          salva.
        </p>
      </header>

      <form className="space-y-3" onSubmit={handleUploadSubmit}>
        <input name="intent" type="hidden" value="upload" />
        <input name="draftKey" type="hidden" value={props.draftStorageKey} />
        <input name="noteType" type="hidden" value={props.noteType} />
        {props.appointmentId ? (
          <input name="appointmentId" type="hidden" value={props.appointmentId} />
        ) : null}
        <label className="block">
          <span className="field-label">Arquivo</span>
          <input
            ref={inputRef}
            accept=".pdf,image/*,.txt,text/plain"
            name="attachment"
            type="file"
            onChange={(event) =>
              setSelectedFile(event.currentTarget.files?.[0]?.name ?? "")
            }
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-xs text-[color:var(--muted)]">
            {selectedFile || "PDF, imagem ou texto até 100 MB"}
          </span>
          <button
            className="button-secondary"
            disabled={isUploading}
            type="submit"
          >
            {isUploading ? "Enviando..." : "Anexar"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm">
          <p>{error}</p>
          <button
            className="button-secondary px-3 py-1 text-xs"
            onClick={() => void refreshAttachments()}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="field-label">Neste rascunho</p>
        {data?.draft.length ? (
          data.draft.map((attachment) => (
            <AttachmentRow
              attachment={attachment}
              canDelete
              key={attachment.id}
              onDelete={deleteAttachment}
              onExecutionChange={setExecution}
              patientId={props.patientId}
              plugins={data.plugins}
            />
          ))
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            Nenhum anexo no rascunho.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="field-label">Anexos salvos</p>
        {data?.attached.length ? (
          data.attached.map((attachment) => (
            <AttachmentRow
              attachment={attachment}
              key={attachment.id}
              onExecutionChange={setExecution}
              patientId={props.patientId}
              plugins={data.plugins}
            />
          ))
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            Nenhum anexo salvo.
          </p>
        )}
      </div>
    </section>
  );
}
