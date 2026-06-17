import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

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
  const listFetcher = useFetcher<AttachmentsResponse>();
  const uploadFetcher = useFetcher<AttachmentsResponse>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [executionOverrides, setExecutionOverrides] = useState<
    Record<string, AttachmentPluginExecutionSummary>
  >({});
  const attachmentsUrl = `/patients/${props.patientId}/attachments?draftKey=${encodeURIComponent(
    props.draftStorageKey,
  )}`;

  useEffect(() => {
    if (listFetcher.state === "idle" && !listFetcher.data) {
      listFetcher.load(attachmentsUrl);
    }
  }, [attachmentsUrl, listFetcher]);

  useEffect(() => {
    if (
      uploadFetcher.state === "idle" &&
      uploadFetcher.data &&
      !uploadFetcher.data.error
    ) {
      listFetcher.load(attachmentsUrl);
      setSelectedFile("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }, [attachmentsUrl, listFetcher, uploadFetcher.data, uploadFetcher.state]);

  const responseData =
    uploadFetcher.data && !uploadFetcher.data.error
      ? uploadFetcher.data
      : listFetcher.data && !listFetcher.data.error
        ? listFetcher.data
        : undefined;
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
  const error = uploadFetcher.data?.error ?? listFetcher.data?.error;
  const isUploading = uploadFetcher.state !== "idle";

  function deleteAttachment(id: number) {
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("attachmentId", String(id));
    formData.set("draftKey", props.draftStorageKey);
    uploadFetcher.submit(formData, {
      action: `/patients/${props.patientId}/attachments`,
      method: "post",
    });
  }

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

      <uploadFetcher.Form
        action={`/patients/${props.patientId}/attachments`}
        className="space-y-3"
        encType="multipart/form-data"
        method="post"
      >
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
      </uploadFetcher.Form>

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
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
