import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useRouteError,
  useSearchParams,
} from "react-router";
import { ZodError } from "zod";

import { ClinicalHistory, type ClinicalHistoryItem } from "~/components/clinical-history";
import { AttachmentsCard } from "~/components/attachments/AttachmentsCard";
import { ResizableSplit } from "~/components/soap/ResizableSplit";
import { SegmentedControl } from "~/components/soap-plugins/SegmentedControl";
import { useToast } from "~/components/toast";
import { requireUserSession } from "~/lib/auth.server";
import {
  clearEncryptedDraft,
  loadEncryptedDraft,
  migratePlainSessionDraft,
  persistEncryptedDraft,
} from "~/lib/encrypted-draft-storage";
import { normalizeNarrativeSections } from "~/lib/narrative-notes";
import {
  createNarrativeNote,
  getPatientNarrativeNotes,
} from "~/lib/narrative-notes.server";
import { prisma } from "~/lib/prisma.server";
import {
  getDocsAppOrigin,
  getDocsIntegrationSettings,
  listPendingDocsWebhookSuggestions,
} from "~/lib/plugins/docs/integration.server";
import { getPatientPersonalDataPrivacy, getUiTimeZone } from "~/lib/settings.server";
import { soapPlugins } from "~/lib/soap-plugins/registry";
import { createSoapNote, getPatientSoapNotes } from "~/lib/soap-notes.server";
import { parseNarrativeForm } from "~/lib/validation/narrative";
import { parseSoapForm } from "~/lib/validation/soap";
import {
  formatDate,
  formatDateTime,
  formatPatientAge,
  toDateTimeLocalValue,
} from "~/lib/utils";

type SoapDraftState = {
  assessment: string;
  encounteredAt: string;
  objective: string;
  plan: string;
  subjective: string;
};

type NarrativeDraftState = {
  body: string;
  encounteredAt: string;
  title: string;
};

type LinkedAppointment = {
  appointmentType: string;
  end: Date | string;
  id: number;
  start: Date | string;
  status: string;
};

type PreviousNote = ClinicalHistoryItem;

type DocsIntegrationState = {
  available: boolean;
  configured: boolean;
  medicalCertificateTemplateId: string;
  origin: string | null;
};

type DocsSuggestion = {
  documentType?: string;
  id?: number;
  text: string;
};

function parseOptionalPositiveInt(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function useBeforeUnloadWarning(when: boolean) {
  useEffect(() => {
    if (!when) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [when]);
}

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.status === 404
      ? "Registro não encontrado."
      : String(error.data || error.statusText || "A tela encontrou uma falha.");
  }

  return error instanceof Error ? error.message : "A tela encontrou uma falha.";
}

function readDocsSuggestionMessage(value: unknown): DocsSuggestion | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  if (data.type !== "docs.clinical-note") {
    return null;
  }

  const clinicalNote =
    typeof data.clinicalNote === "string"
      ? data.clinicalNote
      : typeof data.text === "string"
        ? data.text
        : "";

  const text = clinicalNote.trim();
  if (!text) {
    return null;
  }

  return {
    documentType:
      typeof data.documentType === "string" ? data.documentType : undefined,
    text,
  };
}

function DocsDocumentLauncher(props: {
  docsIntegration: DocsIntegrationState;
  patientBirthDate?: Date | string | null;
  patientId: number;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);

  const configured = props.docsIntegration.available && props.docsIntegration.configured;
  const enabled = configured && Boolean(props.patientBirthDate);
  const options: Array<{
    disabled?: boolean;
    label: string;
    numberShortcut: string;
    shortcut: string;
    shortcutLabel: string;
    value: string;
  }> = [
    {
      label: "Prescrição",
      numberShortcut: "1",
      shortcut: "p",
      shortcutLabel: "P",
      value: "prescription",
    },
    {
      label: "Solicitação de exames",
      numberShortcut: "2",
      shortcut: "r",
      shortcutLabel: "R",
      value: "service-request",
    },
    {
      disabled: !props.docsIntegration.medicalCertificateTemplateId,
      label: "Atestado",
      numberShortcut: "3",
      shortcut: "a",
      shortcutLabel: "A",
      value: "medical-certificate",
    },
    {
      label: "Documento genérico",
      numberShortcut: "4",
      shortcut: "d",
      shortcutLabel: "D",
      value: "generic-document",
    },
  ];

  function openDocument(documentType: string) {
    const targetName = `docs-${documentType}-${Date.now()}`;
    window.open("about:blank", targetName);

    const form = document.createElement("form");
    form.action = `/patients/${props.patientId}/docs`;
    form.method = "post";
    form.target = targetName;
    form.style.display = "none";

    const input = document.createElement("input");
    input.name = "documentType";
    input.value = documentType;
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    form.remove();
    setOpen(false);
  }

  function selectOption(option: (typeof options)[number]) {
    if (!enabled || option.disabled) {
      return;
    }

    openDocument(option.value);
  }

  function toggleOpen() {
    if (!enabled) {
      return;
    }

    const rect = launcherRef.current?.getBoundingClientRect();
    if (rect) {
      setDropUp(window.innerHeight - rect.bottom < 260);
    }
    setOpen((current) => !current);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        launcherRef.current &&
        !launcherRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      const pressed = event.key.toLowerCase();
      const option = options.find(
        (item) => item.shortcut === pressed || item.numberShortcut === pressed,
      );
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, open, options]);

  if (!configured) {
    return null;
  }

  return (
    <div className="relative inline-block w-56" ref={launcherRef}>
      <button
        aria-expanded={open}
        className={[
          "inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
          enabled
            ? "border-blue-500/30 bg-gradient-to-r from-blue-700 to-sky-600 hover:opacity-95"
            : "cursor-not-allowed bg-slate-400 opacity-70 dark:bg-slate-700",
        ].join(" ")}
        disabled={!enabled}
        onClick={toggleOpen}
        title={
          !props.patientBirthDate
            ? "Informe a data de nascimento do paciente."
            : "Gerar documento no Docs"
        }
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
        Gerar documento
        <svg
          aria-hidden="true"
          className={["transition-transform", open ? "rotate-180" : ""].join(" ")}
          fill="none"
          height="16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="16"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className={[
            "absolute right-0 z-30 w-full overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-950/80 p-1.5 text-white shadow-xl backdrop-blur-md dark:bg-blue-950/70",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          ].join(" ")}
        >
          {options.map((option) => (
            <button
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!enabled || option.disabled}
              key={option.value}
              onClick={() => selectOption(option)}
              type="button"
            >
              <span>
                {option.label === "Prescrição" ? (
                  <>
                    <span className="underline underline-offset-4">P</span>rescrição
                  </>
                ) : option.label === "Solicitação de exames" ? (
                  <>
                    Solicitação de exames <span className="underline underline-offset-4">R</span>
                  </>
                ) : option.label === "Atestado" ? (
                  <>
                    <span className="underline underline-offset-4">A</span>testado
                  </>
                ) : (
                  <>
                    <span className="underline underline-offset-4">D</span>ocumento genérico
                  </>
                )}
              </span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs">
                {option.numberShortcut}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SoapNoteForm(props: {
  attachmentDraftKey: string;
  defaultEncounteredAt: string;
  docsIntegration: DocsIntegrationState;
  initialDocsSuggestions: DocsSuggestion[];
  linkedAppointment: LinkedAppointment | null;
  patientBirthDate?: Date | string | null;
  patientId: number;
  resetDraft: boolean;
  timeZone: string;
}) {
  const storageKey = props.linkedAppointment
    ? `patient:${props.patientId}:appointment:${props.linkedAppointment.id}:draft:soap`
    : `patient:${props.patientId}:draft:soap`;
  const emptyState: SoapDraftState = {
    assessment: "",
    encounteredAt: props.defaultEncounteredAt,
    objective: "",
    plan: "",
    subjective: "",
  };
  const [formState, setFormState] = useState<SoapDraftState>(emptyState);
  const [docsSuggestion, setDocsSuggestion] = useState<DocsSuggestion | null>(
    props.initialDocsSuggestions[0] ?? null,
  );
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    if (props.resetDraft) {
      clearEncryptedDraft(storageKey);
      setFormState(emptyState);
      return;
    }

    async function restoreDraft() {
      const restored =
        (await loadEncryptedDraft<SoapDraftState>(storageKey)) ??
        (await migratePlainSessionDraft<SoapDraftState>(storageKey));

      if (!cancelled) {
        setFormState(restored ? { ...emptyState, ...restored } : emptyState);
      }
    }

    void restoreDraft();
    return () => {
      cancelled = true;
    };
  }, [props.defaultEncounteredAt, props.resetDraft, storageKey]);

  const hasUnsavedChanges =
    formState.assessment.trim().length > 0 ||
    formState.encounteredAt !== props.defaultEncounteredAt ||
    formState.objective.trim().length > 0 ||
    formState.plan.trim().length > 0 ||
    formState.subjective.trim().length > 0;

  useEffect(() => {
    if (hasUnsavedChanges) {
      void persistEncryptedDraft(storageKey, formState);
      return;
    }

    clearEncryptedDraft(storageKey);
  }, [formState, hasUnsavedChanges, storageKey]);

  useBeforeUnloadWarning(hasUnsavedChanges);

  useEffect(() => {
    if (!docsSuggestion && props.initialDocsSuggestions[0]) {
      setDocsSuggestion(props.initialDocsSuggestions[0]);
    }
  }, [docsSuggestion, props.initialDocsSuggestions]);

  useEffect(() => {
    if (!props.docsIntegration.origin) {
      return;
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== props.docsIntegration.origin) {
        return;
      }

      const suggestion = readDocsSuggestionMessage(event.data);
      if (!suggestion) {
        return;
      }

      setDocsSuggestion(suggestion);
      showToast({
        message: "O Docs retornou uma sugestão de conduta para inserir no SOAP.",
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [props.docsIntegration.origin, showToast]);

  useEffect(() => {
    if (!props.docsIntegration.configured) {
      return;
    }

    let cancelled = false;

    async function refreshWebhookSuggestions() {
      try {
        const response = await fetch(`/patients/${props.patientId}/docs/events`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          suggestions?: DocsSuggestion[];
        };
        const suggestion = payload.suggestions?.[0];
        if (!suggestion || cancelled) {
          return;
        }

        setDocsSuggestion((current) => {
          if (current?.id && current.id === suggestion.id) {
            return current;
          }

          showToast({
            message: "O Docs enviou uma conduta pelo webhook.",
            tone: "info",
          });
          return suggestion;
        });
      } catch {
        // Polling errors should not interrupt clinical note editing.
      }
    }

    const interval = window.setInterval(refreshWebhookSuggestions, 5000);
    void refreshWebhookSuggestions();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [props.docsIntegration.configured, props.patientId, showToast]);

  function consumeSuggestion(suggestion: DocsSuggestion) {
    if (!suggestion.id) {
      return;
    }

    const formData = new FormData();
    formData.set("eventId", String(suggestion.id));
    void fetch(`/patients/${props.patientId}/docs/events`, {
      body: formData,
      method: "POST",
    });
  }

  function insertDocsSuggestion() {
    if (!docsSuggestion) {
      return;
    }

    setFormState((current) => ({
      ...current,
      plan: [current.plan.trim(), docsSuggestion.text].filter(Boolean).join("\n\n"),
    }));
    consumeSuggestion(docsSuggestion);
    setDocsSuggestion(null);
  }

  return (
    <section className="panel p-6">
      <div>
        <h3 className="text-2xl font-semibold">New SOAP note</h3>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Structured clinical registration with subjective, objective, assessment, and plan.
        </p>
      </div>
      <div>
        {props.linkedAppointment ? (
          <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm">
            Appointment at {formatDateTime(props.linkedAppointment.start, {
              timeZone: props.timeZone,
            })} linked to {props.linkedAppointment.appointmentType}. Saving this SOAP note
            will mark the appointment as fulfilled.
          </p>
        ) : null}
      </div>
      <Form className="mt-8 space-y-5" method="post">
        <input name="noteType" type="hidden" value="soap" />
        <input name="attachmentDraftKey" type="hidden" value={props.attachmentDraftKey} />
        {props.linkedAppointment ? (
          <input
            name="appointmentId"
            type="hidden"
            value={props.linkedAppointment.id}
          />
        ) : null}
        <label className="block">
          <span className="field-label">Encounter date and time</span>
          <input
            name="encounteredAt"
            required
            type="datetime-local"
            value={formState.encounteredAt}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, encounteredAt: value }));
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">Subjective</span>
          <textarea
            name="subjective"
            required
            value={formState.subjective}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, subjective: value }));
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">Objective</span>
          <textarea
            name="objective"
            required
            value={formState.objective}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, objective: value }));
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">Assessment</span>
          <textarea
            name="assessment"
            required
            value={formState.assessment}
            onChange={(event) => {
              const assessment = event.currentTarget.value;
              setFormState((current) => ({
                ...current,
                assessment,
              }));
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">Plan</span>
          <textarea
            name="plan"
            required
            value={formState.plan}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, plan: value }));
            }}
          />
        </label>
        {docsSuggestion ? (
          <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Sugestão do Docs para conduta</p>
                <p className="text-xs text-[color:var(--muted)]">
                  Revise antes de inserir no campo Plan.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="button-tonal-emerald"
                  onClick={insertDocsSuggestion}
                  type="button"
                >
                  Inserir na conduta
                </button>
                <button
                  className="button-secondary"
                  onClick={() => {
                    consumeSuggestion(docsSuggestion);
                    setDocsSuggestion(null);
                  }}
                  type="button"
                >
                  Descartar
                </button>
              </div>
            </div>
            <textarea readOnly value={docsSuggestion.text} />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <DocsDocumentLauncher
            docsIntegration={props.docsIntegration}
            patientBirthDate={props.patientBirthDate}
            patientId={props.patientId}
          />
          <button className="button-primary" type="submit">
            Save SOAP note
          </button>
        </div>
      </Form>
    </section>
  );
}

function NarrativeNoteForm(props: {
  attachmentDraftKey: string;
  defaultEncounteredAt: string;
  patientId: number;
  resetDraft: boolean;
}) {
  const storageKey = `patient:${props.patientId}:draft:narrative`;
  const emptyState: NarrativeDraftState = {
    body: "",
    encounteredAt: props.defaultEncounteredAt,
    title: "",
  };
  const [formState, setFormState] = useState<NarrativeDraftState>(emptyState);

  useEffect(() => {
    let cancelled = false;

    if (props.resetDraft) {
      clearEncryptedDraft(storageKey);
      setFormState(emptyState);
      return;
    }

    async function restoreDraft() {
      const restored =
        (await loadEncryptedDraft<NarrativeDraftState>(storageKey)) ??
        (await migratePlainSessionDraft<NarrativeDraftState>(storageKey));

      if (!cancelled) {
        setFormState(restored ? { ...emptyState, ...restored } : emptyState);
      }
    }

    void restoreDraft();
    return () => {
      cancelled = true;
    };
  }, [props.defaultEncounteredAt, props.resetDraft, storageKey]);

  const hasUnsavedChanges =
    formState.body.trim().length > 0 ||
    formState.encounteredAt !== props.defaultEncounteredAt ||
    formState.title.trim().length > 0;

  useEffect(() => {
    if (hasUnsavedChanges) {
      void persistEncryptedDraft(storageKey, formState);
      return;
    }

    clearEncryptedDraft(storageKey);
  }, [formState, hasUnsavedChanges, storageKey]);

  useBeforeUnloadWarning(hasUnsavedChanges);

  return (
    <section className="panel p-6">
      <div>
        <h3 className="text-2xl font-semibold">New narrative note</h3>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Free-text consultation note exported as FHIR `Composition` narrative.
        </p>
      </div>
      <Form className="mt-8 space-y-5" method="post">
        <input name="noteType" type="hidden" value="narrative" />
        <input name="attachmentDraftKey" type="hidden" value={props.attachmentDraftKey} />
        <label className="block">
          <span className="field-label">Encounter date and time</span>
          <input
            name="encounteredAt"
            required
            type="datetime-local"
            value={formState.encounteredAt}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, encounteredAt: value }));
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">Title</span>
          <input
            name="title"
            placeholder="Optional note title"
            value={formState.title}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, title: value }));
            }}
          />
        </label>
        <label className="block">
          <span className="field-label">Narrative</span>
          <textarea
            name="body"
            required
            value={formState.body}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFormState((current) => ({ ...current, body: value }));
            }}
          />
        </label>
        <div className="flex justify-end">
          <button className="button-primary" type="submit">
            Save narrative note
          </button>
        </div>
      </Form>
    </section>
  );
}

export async function loader({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  const auth = await requireUserSession(request);

  const patientId = Number(params.patientId);
  const url = new URL(request.url);
  const appointmentId = parseOptionalPositiveInt(url.searchParams.get("appointmentId"));
  const [
    patientPersonalDataPrivacy,
    docsIntegration,
    docsWebhookSuggestions,
    patient,
    timeZone,
  ] = await Promise.all([
    getPatientPersonalDataPrivacy(request),
    getDocsIntegrationSettings(auth.user.id),
    listPendingDocsWebhookSuggestions({
      patientId,
      userId: auth.user.id,
    }),
    prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        contacts: true,
        identifier: true,
        mergedInto: {
          select: {
            id: true,
            name: true,
          },
        },
        telecom: true,
      },
    }),
    getUiTimeZone(),
  ]);

  if (!patient) {
    throw new Response("Patient not found", { status: 404 });
  }

  const [notesState, linkedAppointment] = await Promise.all([
    loadRecoverableNotes(patient.id),
    appointmentId
      ? prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            patientId: patient.id,
          },
          select: {
            appointmentType: true,
            end: true,
            id: true,
            start: true,
            status: true,
          },
        })
      : null,
  ]);

  return {
    blurPatientPersonalData: patientPersonalDataPrivacy.shouldBlur,
    contextError: notesState.contextError,
    defaultEncounteredAt: toDateTimeLocalValue(linkedAppointment?.start ?? new Date(), timeZone),
    docsIntegration: {
      ...docsIntegration,
      origin: getDocsAppOrigin(),
    },
    docsWebhookSuggestions,
    linkedAppointment,
    patient,
    previousNotes: notesState.previousNotes,
    soapNoteCount: notesState.soapNoteCount,
    timeZone,
  };
}

async function loadRecoverableNotes(patientId: number) {
  try {
    const [previousSoapNotes, previousNarrativeNotes] = await Promise.all([
      getPatientSoapNotes(patientId),
      getPatientNarrativeNotes(patientId),
    ]);

    const previousNotes: PreviousNote[] = [
      ...previousSoapNotes.map((note) => ({
        author: note.author,
        encounteredAt: note.encounteredAt,
        id: `soap-${note.id}`,
        kind: "soap" as const,
        sections: [
          { text: note.subjective, title: "Subjective" },
          { text: note.objective, title: "Objective" },
          { text: note.assessment, title: "Assessment" },
          { text: note.plan, title: "Plan" },
        ],
        title: "SOAP note",
      })),
      ...previousNarrativeNotes.map((note) => ({
        author: note.author,
        encounteredAt: note.encounteredAt,
        id: `narrative-${note.id}`,
        kind: "narrative" as const,
        sections: normalizeNarrativeSections(note.sections),
        title: note.title?.trim() || "Narrative note",
      })),
    ].sort((left, right) => right.encounteredAt.getTime() - left.encounteredAt.getTime());

    return {
      contextError: null as string | null,
      previousNotes,
      soapNoteCount: previousSoapNotes.length,
    };
  } catch (error) {
    return {
      contextError:
        error instanceof Error
          ? `Não foi possível carregar o histórico: ${error.message}`
          : "Não foi possível carregar o histórico.",
      previousNotes: [] as PreviousNote[],
      soapNoteCount: 0,
    };
  }
}

export function shouldRevalidate({
  defaultShouldRevalidate,
  formAction,
}: {
  defaultShouldRevalidate: boolean;
  formAction?: string;
}) {
  if (formAction?.includes("/soap-plugins/")) {
    return false;
  }

  if (formAction?.includes("/docs")) {
    return false;
  }

  return defaultShouldRevalidate;
}

export async function action({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  const auth = await requireUserSession(request);
  const formData = await request.formData();
  const noteType = String(formData.get("noteType") ?? "soap");
  const appointmentId = parseOptionalPositiveInt(formData.get("appointmentId"));
  const [patient, timeZone] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: Number(params.patientId) },
      select: {
        active: true,
        mergedInto: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    getUiTimeZone(),
  ]);

  if (!patient) {
    throw new Response("Patient not found", { status: 404 });
  }

  if (!patient.active && patient.mergedInto) {
    return {
      error: `This patient was merged into ${patient.mergedInto.name}. Use the surviving record instead.`,
    };
  }

  try {
    if (noteType === "narrative") {
      const input = parseNarrativeForm(formData, timeZone);
      await createNarrativeNote({
        attachmentDraftKey: String(formData.get("attachmentDraftKey") ?? ""),
        authorUserId: auth.user.id,
        encounteredAt: input.encounteredAt,
        patientId: Number(params.patientId),
        sections: [
          {
            text: input.body,
            title: input.title?.trim() || "Narrative",
          },
        ],
        title: input.title,
      });
    } else {
      const input = parseSoapForm(formData, timeZone);
      await createSoapNote({
        ...input,
        appointmentId,
        attachmentDraftKey: String(formData.get("attachmentDraftKey") ?? ""),
        authorUserId: auth.user.id,
        patientId: Number(params.patientId),
      });
    }

    throw redirect(
      `/patients/${params.patientId}/soap?saved=${noteType}${
        noteType === "soap" && appointmentId ? `&appointmentId=${appointmentId}` : ""
      }`,
    );
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof ZodError) {
      return {
        error:
          error.issues[0]?.message ??
          (noteType === "narrative" ? "Invalid narrative note." : "Invalid SOAP note."),
      };
    }

    return {
      error: error instanceof Error ? error.message : "Could not save the note.",
    };
  }
}

export default function SoapRoute() {
  const {
    blurPatientPersonalData,
    contextError,
    defaultEncounteredAt,
    docsIntegration,
    docsWebhookSuggestions,
    linkedAppointment,
    patient,
    previousNotes,
    soapNoteCount,
    timeZone,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const patientAge = formatPatientAge(patient.birthDate, { timeZone });
  const savedType = searchParams.get("saved");
  const sensitiveClassName = blurPatientPersonalData ? "privacy-blur" : undefined;

  const [noteType, setNoteType] = useState<"soap" | "narrative">(
    savedType === "narrative" ? "narrative" : "soap",
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isXlViewport, setIsXlViewport] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("soap:split:open");
      if (stored !== null) setSidebarOpen(stored === "true");
    } catch {
      // ignore
    }
    const mq = window.matchMedia("(min-width: 1280px)");
    setIsXlViewport(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsXlViewport(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("soap:split:open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const draftStorageKey = linkedAppointment
    ? `patient:${patient.id}:appointment:${linkedAppointment.id}:draft:soap`
    : `patient:${patient.id}:draft:soap`;
  const narrativeDraftStorageKey = `patient:${patient.id}:draft:narrative`;
  const activeDraftStorageKey = noteType === "soap" ? draftStorageKey : narrativeDraftStorageKey;

  useEffect(() => {
    if (!savedType) {
      return;
    }

    const savedAppointmentId = parseOptionalPositiveInt(searchParams.get("appointmentId"));

    if (savedType === "soap") {
      clearEncryptedDraft(`patient:${patient.id}:draft:soap`);
      if (savedAppointmentId) {
        clearEncryptedDraft(`patient:${patient.id}:appointment:${savedAppointmentId}:draft:soap`);
      }
    }

    if (savedType === "narrative") {
      clearEncryptedDraft(`patient:${patient.id}:draft:narrative`);
    }

    navigate(`/patients/${patient.id}/soap`, { replace: true });
  }, [navigate, patient.id, savedType]);

  useEffect(() => {
    if (actionData?.error) {
      showToast({
        message: `Não foi possível salvar. Seu rascunho foi mantido. ${actionData.error}`,
      });
    }
  }, [actionData?.error, showToast]);

  useEffect(() => {
    if (contextError) {
      showToast({ message: contextError, tone: "warning" });
    }
  }, [contextError, showToast]);

  const contextPanel = (
    <div className="space-y-4">
      <ClinicalHistory notes={previousNotes} timeZone={timeZone} />
      <AttachmentsCard
        appointmentId={linkedAppointment?.id ?? null}
        draftStorageKey={activeDraftStorageKey}
        noteType={noteType}
        patientId={patient.id}
      />
      {soapPlugins.map((plugin) => (
        <plugin.Card
          draftStorageKey={draftStorageKey}
          key={plugin.id}
          patient={patient}
          patientId={patient.id}
          soapNoteCount={soapNoteCount}
          timeZone={timeZone}
        />
      ))}
    </div>
  );

  const editorPanel = patient.active ? (
    <div className="space-y-4">
      {noteType === "soap" ? (
        <SoapNoteForm
          attachmentDraftKey={draftStorageKey}
          defaultEncounteredAt={defaultEncounteredAt}
          docsIntegration={docsIntegration}
          initialDocsSuggestions={docsWebhookSuggestions}
          linkedAppointment={linkedAppointment}
          patientBirthDate={patient.birthDate}
          patientId={patient.id}
          resetDraft={savedType === "soap"}
          timeZone={timeZone}
        />
      ) : (
        <NarrativeNoteForm
          attachmentDraftKey={narrativeDraftStorageKey}
          defaultEncounteredAt={defaultEncounteredAt}
          patientId={patient.id}
          resetDraft={savedType === "narrative"}
        />
      )}
    </div>
  ) : null;

  return (
    <div className="relative left-1/2 w-screen max-w-[1536px] -translate-x-1/2 space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Clinical registration
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2
                className={["text-3xl font-semibold", sensitiveClassName]
                  .filter(Boolean)
                  .join(" ")}
              >
                {patient.name}
              </h2>
              {patientAge ? (
                <span className="text-sm font-medium text-[color:var(--muted)]">{patientAge}</span>
              ) : null}
              {patient.isDraft ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Draft
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
              <span className={sensitiveClassName}>
                {patient.birthDate ? formatDate(patient.birthDate) : "Birth date pending"}
              </span>
              <span className="uppercase">{patient.gender}</span>
              {patient.identifier[0] ? (
                <span className={sensitiveClassName}>
                  {patient.identifier[0].system}: {patient.identifier[0].value}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to={`/patients/${patient.id}/edit`}>
              Edit patient
            </Link>
            <Link className="button-secondary" to="/patients">
              Back to list
            </Link>
          </div>
        </div>
      </section>

      {patient.isDraft ? (
        <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
          This patient is still marked as draft. Complete the registration when the missing data
          becomes available.
        </p>
      ) : null}

      {!patient.active && patient.mergedInto ? (
        <p className="rounded-2xl border border-slate-500/20 bg-slate-500/10 px-4 py-3 text-sm">
          This patient was merged into{" "}
          <Link className="font-semibold underline" to={`/patients/${patient.mergedInto.id}/edit`}>
            {patient.mergedInto.name}
          </Link>
          . Historical notes remain visible here, but new entries must be recorded on the
          surviving patient.
        </p>
      ) : null}

      {patient.active ? (
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl
            onChange={setNoteType}
            options={[
              { label: "SOAP note", value: "soap" },
              { label: "Narrative note", value: "narrative" },
            ]}
            tone="violet"
            value={noteType}
          />
          {isXlViewport ? (
            <button
              aria-label={sidebarOpen ? "Collapse context panel" : "Expand context panel"}
              aria-pressed={sidebarOpen}
              className="rounded-full border border-[color:var(--panel-border)] bg-white/50 p-2 text-[color:var(--muted)] transition hover:bg-white/80 hover:text-[color:var(--foreground)] dark:bg-slate-950/40 dark:hover:bg-slate-900/60"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Collapse context panel" : "Expand context panel"}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2z" />
                <path d="M15 4v16" />
                <path
                  className="origin-[10px_12px] transition-transform duration-200"
                  d="m9 10 2 2 -2 2"
                  style={{ transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)" }}
                />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      <ResizableSplit
        left={editorPanel ?? <div />}
        onOpenChange={setSidebarOpen}
        open={sidebarOpen}
        right={contextPanel}
        storageKey="soap:split"
      />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { showToast } = useToast();
  const message = getErrorMessage(error);

  useEffect(() => {
    showToast({
      message: `A tela de registro encontrou uma falha, mas rascunhos digitados continuam salvos neste navegador. ${message}`,
    });
  }, [message, showToast]);

  return (
    <div className="relative left-1/2 w-screen max-w-[1536px] -translate-x-1/2 space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="panel space-y-4 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
          Clinical registration
        </p>
        <h2 className="text-2xl font-semibold">Não foi possível renderizar esta tela.</h2>
        <p className="max-w-3xl text-sm text-[color:var(--muted)]">
          Os campos de atendimento são salvos continuamente em rascunho local
          criptografado. Recarregue a página do paciente para restaurar o texto digitado.
        </p>
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {message}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="button-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Recarregar tela
          </button>
          <Link className="button-secondary" to="/patients">
            Voltar para pacientes
          </Link>
        </div>
      </section>
    </div>
  );
}
