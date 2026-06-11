import { useEffect, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router";
import { ZodError } from "zod";

import { ClinicalHistory } from "~/components/clinical-history";
import { ResizableSplit } from "~/components/soap/ResizableSplit";
import { SegmentedControl } from "~/components/soap-plugins/SegmentedControl";
import { genericPlugins, soapPlugins } from "~/lib/soap-plugins/registry";
import { requireUserSession } from "~/lib/auth.server";
import { normalizeNarrativeSections } from "~/lib/narrative-notes";
import {
  createNarrativeNote,
  getPatientNarrativeNotes,
} from "~/lib/narrative-notes.server";
import { prisma } from "~/lib/prisma.server";
import { getPatientPersonalDataPrivacy, getUiTimeZone } from "~/lib/settings.server";
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

function parseOptionalPositiveInt(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function loadDraft<T extends Record<string, string>>(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.sessionStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Partial<T>;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

function persistDraft(storageKey: string, value: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(value));
}

function clearDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(storageKey);
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

function SoapNoteForm(props: {
  attachmentDraftKey: string;
  defaultEncounteredAt: string;
  linkedAppointment: LinkedAppointment | null;
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

  useEffect(() => {
    if (props.resetDraft) {
      clearDraft(storageKey);
      setFormState(emptyState);
      return;
    }

    const restored = loadDraft<SoapDraftState>(storageKey);
    setFormState(restored ? { ...emptyState, ...restored } : emptyState);
  }, [props.defaultEncounteredAt, props.resetDraft, storageKey]);

  const hasUnsavedChanges =
    formState.assessment.trim().length > 0 ||
    formState.encounteredAt !== props.defaultEncounteredAt ||
    formState.objective.trim().length > 0 ||
    formState.plan.trim().length > 0 ||
    formState.subjective.trim().length > 0;

  useEffect(() => {
    if (hasUnsavedChanges) {
      persistDraft(storageKey, formState);
      return;
    }

    clearDraft(storageKey);
  }, [formState, hasUnsavedChanges, storageKey]);

  useBeforeUnloadWarning(hasUnsavedChanges);

  return (
    <section className="panel p-6">
      <div>
        <h3 className="text-2xl font-semibold">New SOAP note</h3>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Structured clinical registration with subjective, objective, assessment, and plan.
        </p>
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
        <div className="flex justify-end">
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
    if (props.resetDraft) {
      clearDraft(storageKey);
      setFormState(emptyState);
      return;
    }

    const restored = loadDraft<NarrativeDraftState>(storageKey);
    setFormState(restored ? { ...emptyState, ...restored } : emptyState);
  }, [props.defaultEncounteredAt, props.resetDraft, storageKey]);

  const hasUnsavedChanges =
    formState.body.trim().length > 0 ||
    formState.encounteredAt !== props.defaultEncounteredAt ||
    formState.title.trim().length > 0;

  useEffect(() => {
    if (hasUnsavedChanges) {
      persistDraft(storageKey, formState);
      return;
    }

    clearDraft(storageKey);
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
  await requireUserSession(request);

  const patientId = Number(params.patientId);
  const url = new URL(request.url);
  const appointmentId = parseOptionalPositiveInt(url.searchParams.get("appointmentId"));
  const [patientPersonalDataPrivacy, patient, timeZone] = await Promise.all([
    getPatientPersonalDataPrivacy(request),
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

  const [previousSoapNotes, previousNarrativeNotes, linkedAppointment] = await Promise.all([
    getPatientSoapNotes(patient.id),
    getPatientNarrativeNotes(patient.id),
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

  const previousNotes = [
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
    blurPatientPersonalData: patientPersonalDataPrivacy.shouldBlur,
    defaultEncounteredAt: toDateTimeLocalValue(linkedAppointment?.start ?? new Date(), timeZone),
    linkedAppointment,
    patient,
    previousNotes,
    soapNoteCount: previousSoapNotes.length,
    timeZone,
  };
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
    defaultEncounteredAt,
    linkedAppointment,
    patient,
    previousNotes,
    soapNoteCount,
    timeZone,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      clearDraft(`patient:${patient.id}:draft:soap`);
      if (savedAppointmentId) {
        clearDraft(`patient:${patient.id}:appointment:${savedAppointmentId}:draft:soap`);
      }
    }

    if (savedType === "narrative") {
      clearDraft(`patient:${patient.id}:draft:narrative`);
    }

    navigate(`/patients/${patient.id}/soap`, { replace: true });
  }, [navigate, patient.id, savedType]);

  const contextPanel = (
    <div className="space-y-4">
      <ClinicalHistory notes={previousNotes} timeZone={timeZone} />
      {genericPlugins.map((plugin) => (
        <plugin.Card
          appointmentId={linkedAppointment?.id ?? null}
          draftStorageKey={activeDraftStorageKey}
          key={plugin.id}
          noteType={noteType}
          patientId={patient.id}
          timeZone={timeZone}
        />
      ))}
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
      {actionData?.error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {actionData.error}
        </p>
      ) : null}
      {noteType === "soap" ? (
        <SoapNoteForm
          attachmentDraftKey={draftStorageKey}
          defaultEncounteredAt={defaultEncounteredAt}
          linkedAppointment={linkedAppointment}
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
