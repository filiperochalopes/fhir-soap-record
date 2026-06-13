import { useId, useRef, useState, type DragEvent } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { ZodError } from "zod";

import { ThemeToggle } from "~/components/theme-toggle";
import { requireUserSession } from "~/lib/auth.server";
import { getExportOverview } from "~/lib/export.server";
import { env } from "~/lib/env.server";
import { importFhirBundle } from "~/lib/import.server";
import {
  hasPluginCredential,
  removePluginCredential,
  setPluginCredential,
} from "~/lib/plugin-credentials.server";
import { prisma } from "~/lib/prisma.server";
import {
  getBlurPatientPersonalData,
  getPatientPersonalDataPrivacy,
  getUiTimeZone,
  setPatientPersonalDataVisibleCookie,
  setBlurPatientPersonalData,
  setUiTimeZone,
} from "~/lib/settings.server";
import {
  formatDateTime,
  formatTimeZoneOffsetLabel,
  isValidTimeZone,
} from "~/lib/utils";
import { bundleSchema } from "~/lib/validation/import";

type ImportReportItem = {
  error?: string;
  fileName: string;
  summary?: {
    created: number;
    errors: number;
    processed: number;
    skipped: number;
    updated: number;
  };
};

type SettingsActionData = {
  error?: string;
  importedAt?: string;
  results?: ImportReportItem[];
  savedBlurPatientPersonalData?: boolean;
  savedMeuExameCredential?: boolean;
  savedTimeZone?: string;
  meuExameSettingsError?: string;
  settingsError?: string;
  totals?: {
    created: number;
    errors: number;
    files: number;
    processed: number;
    skipped: number;
    updated: number;
  };
};

export async function loader({ request }: { request: Request }) {
  const auth = await requireUserSession(request);
  const [blurPatientPersonalData, meuExameConfigured, overview, timeZone] =
    await Promise.all([
      getBlurPatientPersonalData(),
      hasPluginCredential(auth.user.id, "meuexame"),
      getExportOverview(),
      getUiTimeZone(),
    ]);

  return {
    ...overview,
    blurPatientPersonalData,
    meuExame: {
      available: Boolean(env.MEUEXAME_API_BASE_URL),
      configured: meuExameConfigured,
    },
    timePreview: formatDateTime(new Date(), { timeZone }),
    timeZone,
    timeZoneOffset: formatTimeZoneOffsetLabel(timeZone),
  };
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<SettingsActionData | Response> {
  const auth = await requireUserSession(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "import");

  if (intent === "save-meuexame-token") {
    if (!env.MEUEXAME_API_BASE_URL) {
      return { meuExameSettingsError: "Plugin MeuExame não está disponível." };
    }
    try {
      await setPluginCredential({
        pluginId: "meuexame",
        secret: String(formData.get("token") ?? ""),
        userId: auth.user.id,
      });
      return { savedMeuExameCredential: true };
    } catch (error) {
      return {
        meuExameSettingsError:
          error instanceof Error ? error.message : "Não foi possível salvar o token.",
      };
    }
  }

  if (intent === "remove-meuexame-token") {
    try {
      await removePluginCredential({
        pluginId: "meuexame",
        userId: auth.user.id,
      });
      return { savedMeuExameCredential: false };
    } catch (error) {
      return {
        meuExameSettingsError:
          error instanceof Error ? error.message : "Não foi possível remover o token.",
      };
    }
  }

  if (intent === "save-timezone") {
    const rawTimeZone = String(formData.get("timeZone") ?? "").trim();

    if (!rawTimeZone) {
      return {
        settingsError: "Enter a valid IANA timezone, for example America/Bahia.",
      };
    }

    if (!isValidTimeZone(rawTimeZone)) {
      return {
        settingsError: "Invalid timezone. Use a valid IANA name such as America/Bahia.",
      };
    }

    return {
      savedTimeZone: await setUiTimeZone(rawTimeZone),
    };
  }

  if (intent === "save-privacy") {
    const savedBlurPatientPersonalData = await setBlurPatientPersonalData(
      formData.get("blurPatientPersonalData") === "on",
    );

    return new Response(JSON.stringify({ savedBlurPatientPersonalData }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setPatientPersonalDataVisibleCookie(false),
      },
    });
  }

  if (intent === "toggle-patient-personal-data-visibility") {
    const currentPrivacy = await getPatientPersonalDataPrivacy(request);
    const nextVisible = currentPrivacy.enabled && !currentPrivacy.visible;

    return new Response(JSON.stringify({ visible: nextVisible }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setPatientPersonalDataVisibleCookie(nextVisible),
      },
    });
  }

  const actor = await prisma.authUser.findUniqueOrThrow({
    where: { id: auth.user.id },
  });
  const files = formData
    .getAll("bundles")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) {
    return {
      error: "Select one or more JSON files to import.",
    };
  }

  const results: ImportReportItem[] = [];
  const totals = {
    created: 0,
    errors: 0,
    files: files.length,
    processed: 0,
    skipped: 0,
    updated: 0,
  };

  for (const file of files) {
    try {
      const rawContent = await file.text();
      const parsed = bundleSchema.parse(JSON.parse(rawContent));
      const summary = await importFhirBundle(parsed, actor);

      totals.created += summary.created;
      totals.errors += summary.errors.length;
      totals.processed += summary.processed;
      totals.skipped += summary.skipped;
      totals.updated += summary.updated;

      results.push({
        fileName: file.name || "bundle.json",
        summary: {
          created: summary.created,
          errors: summary.errors.length,
          processed: summary.processed,
          skipped: summary.skipped,
          updated: summary.updated,
        },
      });

      for (const importError of summary.errors) {
        results.push({
          error: `${importError.item}: ${importError.message}`,
          fileName: file.name || "bundle.json",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof ZodError
          ? error.issues[0]?.message || "Invalid bundle payload."
          : error instanceof Error
            ? error.message
            : "Could not import this file.";

      totals.errors += 1;
      results.push({
        error: errorMessage,
        fileName: file.name || "bundle.json",
      });
    }
  }

  return {
    importedAt: new Date().toISOString(),
    results,
    totals,
  };
}

function ImportDropzone(props: { timeZone: string }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const isSubmitting =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "import";

  function syncFiles(files: FileList | null) {
    setSelectedFiles(files ? Array.from(files).map((file) => file.name) : []);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!event.dataTransfer.files?.length || !inputRef.current) {
      return;
    }

    (inputRef.current as HTMLInputElement & { files: FileList }).files = event.dataTransfer.files;
    syncFiles(event.dataTransfer.files);
  }

  return (
    <section className="panel space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          Import
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Upload one or more bundles</h2>
        <p className="max-w-3xl text-sm text-[color:var(--muted)]">
          Patients are matched again by stable exported identifiers, and notes are deduplicated by
          stable source identifiers. Appointment reimports are matched by patient plus `start/end`.
        </p>
      </div>

      <Form className="space-y-4" encType="multipart/form-data" method="post">
        <input name="intent" type="hidden" value="import" />
        <label
          className={[
            "block rounded-[2rem] border-2 border-dashed px-6 py-10 text-center transition",
            isDragging
              ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10"
              : "border-black/10 bg-black/[0.03] hover:border-[color:var(--accent)]/50 dark:border-white/10 dark:bg-white/[0.03]",
          ].join(" ")}
          htmlFor={inputId}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            accept=".json,application/json"
            className="sr-only"
            id={inputId}
            multiple
            name="bundles"
            type="file"
            onChange={(event) => syncFiles(event.currentTarget.files)}
          />
          <div className="space-y-3">
            <p className="text-base font-semibold">Drag and drop JSON files here</p>
            <p className="text-sm text-[color:var(--muted)]">
              You can upload one full-instance export or multiple patient bundle files.
            </p>
            <div>
              <span className="button-secondary inline-flex">Choose files</span>
            </div>
          </div>
        </label>

        {selectedFiles.length ? (
          <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <p className="font-medium">{selectedFiles.length} file(s) selected</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedFiles.map((fileName) => (
                <span
                  key={fileName}
                  className="rounded-full border border-black/10 px-3 py-1 text-xs dark:border-white/10"
                >
                  {fileName}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {actionData?.error ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
            {actionData.error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button className="button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Importing..." : "Import selected JSON files"}
          </button>
        </div>
      </Form>

      {actionData?.totals ? (
        <div className="space-y-4 rounded-3xl border border-black/5 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Import report
            </p>
            <p className="text-sm text-[color:var(--muted)]">
              {actionData.importedAt
                ? `Completed at ${formatDateTime(actionData.importedAt, { timeZone: props.timeZone })}.`
                : null}
            </p>
          </div>

          <dl className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Files</dt>
              <dd className="mt-2 text-xl font-semibold">{actionData.totals.files}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Processed</dt>
              <dd className="mt-2 text-xl font-semibold">{actionData.totals.processed}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Created</dt>
              <dd className="mt-2 text-xl font-semibold">{actionData.totals.created}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Updated</dt>
              <dd className="mt-2 text-xl font-semibold">{actionData.totals.updated}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Skipped</dt>
              <dd className="mt-2 text-xl font-semibold">{actionData.totals.skipped}</dd>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/30">
              <dt className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Errors</dt>
              <dd className="mt-2 text-xl font-semibold">{actionData.totals.errors}</dd>
            </div>
          </dl>

          {actionData.results?.length ? (
            <div className="overflow-x-auto rounded-3xl border border-black/5 dark:border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-black/5 text-xs uppercase tracking-[0.22em] text-[color:var(--muted)] dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-4">File</th>
                    <th className="px-5 py-4">Processed</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4">Skipped</th>
                    <th className="px-5 py-4">Errors</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actionData.results.map((result, index) => (
                    <tr className="border-t border-black/5 dark:border-white/10" key={`${result.fileName}-${index}`}>
                      <td className="px-5 py-4 font-medium">{result.fileName}</td>
                      <td className="px-5 py-4">{result.summary?.processed ?? "—"}</td>
                      <td className="px-5 py-4">{result.summary?.created ?? "—"}</td>
                      <td className="px-5 py-4">{result.summary?.updated ?? "—"}</td>
                      <td className="px-5 py-4">{result.summary?.skipped ?? "—"}</td>
                      <td className="px-5 py-4">{result.summary?.errors ?? (result.error ? 1 : "—")}</td>
                      <td className="px-5 py-4">
                        {result.error ? (
                          <span className="text-red-600 dark:text-red-300">{result.error}</span>
                        ) : (
                          <span className="text-[color:var(--muted)]">Imported</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TimeZoneSettings(props: {
  timePreview: string;
  timeZone: string;
  timeZoneOffset: string;
}) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "save-timezone";

  return (
    <section className="panel space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          Date and time
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Timezone</h2>
        <p className="max-w-3xl text-sm text-[color:var(--muted)]">
          Datetime inputs and on-screen timestamps use this timezone. Stored values can remain in
          GMT/UTC while the interface renders them in the selected zone.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Current timezone
          </div>
          <div className="mt-2 font-mono text-sm">{props.timeZone}</div>
        </div>
        <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Offset now
          </div>
          <div className="mt-2 text-sm font-semibold">{props.timeZoneOffset}</div>
        </div>
        <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Current local time
          </div>
          <div className="mt-2 text-sm font-semibold">{props.timePreview}</div>
        </div>
      </div>

      <Form className="space-y-4" method="post">
        <input name="intent" type="hidden" value="save-timezone" />
        <label className="block">
          <span className="field-label">IANA timezone</span>
          <input
            defaultValue={props.timeZone}
            name="timeZone"
            placeholder="America/Bahia"
            required
          />
        </label>
        <p className="text-sm text-[color:var(--muted)]">
          Default recomendado: <span className="font-mono">America/Bahia</span>
        </p>

        {actionData?.settingsError ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
            {actionData.settingsError}
          </p>
        ) : null}

        {actionData?.savedTimeZone ? (
          <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
            Timezone updated to {actionData.savedTimeZone}.
          </p>
        ) : null}

        <div className="flex justify-end">
          <button className="button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : "Save timezone"}
          </button>
        </div>
      </Form>
    </section>
  );
}

function PrivacySettings(props: { blurPatientPersonalData: boolean }) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "save-privacy";

  return (
    <section className="panel space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          Privacy
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Patient personal data</h2>
        <p className="max-w-3xl text-sm text-[color:var(--muted)]">
          Blur patient name, birth date, and CPF/identifier on Patients, Agenda, and SOAP screens
          for videos, recordings, and third-party demonstrations.
        </p>
      </div>

      <Form className="space-y-4" method="post">
        <input name="intent" type="hidden" value="save-privacy" />
        <label className="flex items-start gap-3 rounded-3xl border border-black/5 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <input
            defaultChecked={props.blurPatientPersonalData}
            name="blurPatientPersonalData"
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-semibold">Ocultar dados pessoais do paciente</span>
            <span className="mt-1 block text-sm text-[color:var(--muted)]">
              Aplica blur em nome, data de nascimento e CPF/identificador sem alterar os dados
              salvos.
            </span>
          </span>
        </label>

        {typeof actionData?.savedBlurPatientPersonalData === "boolean" ? (
          <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
            Privacy setting updated.
          </p>
        ) : null}

        <div className="flex justify-end">
          <button className="button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : "Save privacy"}
          </button>
        </div>
      </Form>
    </section>
  );
}

function MeuExameSettings(props: {
  available: boolean;
  configured: boolean;
}) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const isSubmitting =
    navigation.state === "submitting" &&
    ["save-meuexame-token", "remove-meuexame-token"].includes(String(intent));
  const configured =
    typeof actionData?.savedMeuExameCredential === "boolean"
      ? actionData.savedMeuExameCredential
      : props.configured;

  if (!props.available) {
    return null;
  }

  return (
    <section className="panel space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          Attachment plugin
        </p>
        <h2 className="text-xl font-semibold tracking-tight">MeuExame</h2>
        <p className="max-w-3xl text-sm text-[color:var(--muted)]">
          Configure seu token pessoal para processar PDFs e imagens anexados. O token é
          criptografado e não pode ser visualizado depois de salvo.
        </p>
      </div>

      <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
        Status:{" "}
        <span className="font-semibold">
          {configured ? "Token configurado" : "Token não configurado"}
        </span>
      </div>

      <Form className="space-y-4" method="post">
        <input name="intent" type="hidden" value="save-meuexame-token" />
        <label className="block">
          <span className="field-label">
            {configured ? "Substituir token" : "Token da integração"}
          </span>
          <input
            autoComplete="off"
            name="token"
            placeholder="mex_..."
            required
            type="password"
          />
        </label>
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Salvando..." : configured ? "Substituir token" : "Salvar token"}
        </button>
      </Form>

      {configured ? (
        <Form method="post">
          <input name="intent" type="hidden" value="remove-meuexame-token" />
          <button
            className="rounded-full border border-red-500/20 px-4 py-2 text-sm text-red-700 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
            disabled={isSubmitting}
            type="submit"
          >
            Remover token
          </button>
        </Form>
      ) : null}

      {actionData?.meuExameSettingsError ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {actionData.meuExameSettingsError}
        </p>
      ) : null}

      {typeof actionData?.savedMeuExameCredential === "boolean" ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
          Configuração do MeuExame atualizada.
        </p>
      ) : null}
    </section>
  );
}

export default function SettingsRoute() {
  const {
    blurPatientPersonalData,
    counts,
    meuExame,
    namespace,
    timePreview,
    timeZone,
    timeZoneOffset,
  } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Appearance
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="max-w-2xl text-sm text-[color:var(--muted)]">
            Theme preference is stored locally in this browser. Use the selector below to switch
            between system, light, and dark mode.
          </p>
        </div>
        <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <ThemeToggle />
        </div>
      </section>

      <TimeZoneSettings
        timePreview={timePreview}
        timeZone={timeZone}
        timeZoneOffset={timeZoneOffset}
      />

      <PrivacySettings blurPatientPersonalData={blurPatientPersonalData} />

      <MeuExameSettings
        available={meuExame.available}
        configured={meuExame.configured}
      />

      <section className="panel space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Export
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Full instance bundle</h2>
          <p className="max-w-3xl text-sm text-[color:var(--muted)]">
            Download one JSON bundle ready for `POST /fhir` in another instance. The export uses a
            stable instance namespace and stable resource identifiers so repeated imports can skip
            what is already present instead of duplicating patients and notes.
          </p>
        </div>

        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Patients
            </dt>
            <dd className="mt-2 text-2xl font-semibold">{counts.patients}</dd>
          </div>
          <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Appointments
            </dt>
            <dd className="mt-2 text-2xl font-semibold">{counts.appointments}</dd>
          </div>
          <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              SOAP notes
            </dt>
            <dd className="mt-2 text-2xl font-semibold">{counts.soapNotes}</dd>
          </div>
          <div className="rounded-3xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              Narrative notes
            </dt>
            <dd className="mt-2 text-2xl font-semibold">{counts.narrativeNotes}</dd>
          </div>
        </dl>

        <div className="space-y-3 rounded-3xl border border-black/5 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm text-[color:var(--muted)]">
            Instance export namespace: <span className="font-mono text-[color:var(--foreground)]">{namespace}</span>
          </p>
          <div>
            <a className="button-primary inline-flex" href="/settings/export">
              Download Full Export JSON
            </a>
          </div>
        </div>
      </section>

      <ImportDropzone timeZone={timeZone} />
    </div>
  );
}
