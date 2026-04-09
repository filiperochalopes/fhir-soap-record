import { useEffect, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router";
import { ZodError } from "zod";

import { ClinicalHistory } from "~/components/clinical-history";
import { ClinicalSummaryCard } from "~/components/clinical-summary";
import { requireUserSession } from "~/lib/auth.server";
import { normalizeNarrativeSections } from "~/lib/narrative-notes";
import {
  createNarrativeNote,
  getPatientNarrativeNotes,
} from "~/lib/narrative-notes.server";
import { prisma } from "~/lib/prisma.server";
import { getUiTimeZone } from "~/lib/settings.server";
import { createSoapNote, getPatientSoapNotes } from "~/lib/soap-notes.server";
import { parseNarrativeForm } from "~/lib/validation/narrative";
import { parseSoapForm } from "~/lib/validation/soap";
import {
  formatDate,
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
  defaultEncounteredAt: string;
  patientId: number;
  resetDraft: boolean;
}) {
  const storageKey = `patient:${props.patientId}:draft:soap`;
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
      </div>
      <Form className="mt-8 space-y-5" method="post">
        <input name="noteType" type="hidden" value="soap" />
        <label className="block">
          <span className="field-label">Encounter date and time</span>
          <input
            name="encounteredAt"
            required
            type="datetime-local"
            value={formState.encounteredAt}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                encounteredAt: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Subjective</span>
          <textarea
            name="subjective"
            required
            value={formState.subjective}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                subjective: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Objective</span>
          <textarea
            name="objective"
            required
            value={formState.objective}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                objective: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Assessment</span>
          <textarea
            name="assessment"
            required
            value={formState.assessment}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                assessment: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Plan</span>
          <textarea
            name="plan"
            required
            value={formState.plan}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                plan: event.currentTarget.value,
              }))
            }
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
        <label className="block">
          <span className="field-label">Encounter date and time</span>
          <input
            name="encounteredAt"
            required
            type="datetime-local"
            value={formState.encounteredAt}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                encounteredAt: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Title</span>
          <input
            name="title"
            placeholder="Optional note title"
            value={formState.title}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                title: event.currentTarget.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Narrative</span>
          <textarea
            name="body"
            required
            value={formState.body}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                body: event.currentTarget.value,
              }))
            }
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
  const [patient, timeZone] = await Promise.all([
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

  const [previousSoapNotes, previousNarrativeNotes] = await Promise.all([
    getPatientSoapNotes(patient.id),
    getPatientNarrativeNotes(patient.id),
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
    defaultEncounteredAt: toDateTimeLocalValue(new Date(), timeZone),
    patient,
    previousNotes,
    soapNoteCount: previousSoapNotes.length,
    timeZone,
  };
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
        authorUserId: auth.user.id,
        patientId: Number(params.patientId),
      });
    }

    throw redirect(`/patients/${params.patientId}/soap?saved=${noteType}`);
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
      error: "Could not save the note.",
    };
  }
}

export default function SoapRoute() {
  const { defaultEncounteredAt, patient, previousNotes, soapNoteCount, timeZone } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const summaryFetcher = useFetcher<{ summary: import("~/lib/clinical-summary.server").ClinicalSummary | null }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [summaryRequested, setSummaryRequested] = useState(false);
  const patientAge = formatPatientAge(patient.birthDate, { timeZone });
  const savedType = searchParams.get("saved");

  useEffect(() => {
    if (!savedType) {
      return;
    }

    if (savedType === "soap") {
      clearDraft(`patient:${patient.id}:draft:soap`);
    }

    if (savedType === "narrative") {
      clearDraft(`patient:${patient.id}:draft:narrative`);
    }

    navigate(`/patients/${patient.id}/soap`, { replace: true });
  }, [navigate, patient.id, savedType]);

  useEffect(() => {
    if (!soapNoteCount) {
      return;
    }

    if (summaryFetcher.state !== "idle" || summaryFetcher.data) {
      return;
    }

    setSummaryRequested(true);
    summaryFetcher.load(`/patients/${patient.id}/summary`);
  }, [patient.id, soapNoteCount, summaryFetcher]);

  const summaryError =
    summaryRequested && summaryFetcher.state === "idle" && summaryFetcher.data === undefined;

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Clinical registration
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold">{patient.name}</h2>
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
              <span>{patient.birthDate ? formatDate(patient.birthDate) : "Birth date pending"}</span>
              <span className="uppercase">{patient.gender}</span>
              {patient.identifier[0] ? (
                <span>
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

      <ClinicalSummaryCard
        error={summaryError}
        isLoading={soapNoteCount > 0 && summaryFetcher.state !== "idle"}
        soapNoteCount={soapNoteCount}
        summary={summaryFetcher.data?.summary ?? null}
      />

      <ClinicalHistory notes={previousNotes} timeZone={timeZone} />

      {actionData?.error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {actionData.error}
        </p>
      ) : null}

      {patient.active ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SoapNoteForm
            defaultEncounteredAt={defaultEncounteredAt}
            patientId={patient.id}
            resetDraft={savedType === "soap"}
          />
          <NarrativeNoteForm
            defaultEncounteredAt={defaultEncounteredAt}
            patientId={patient.id}
            resetDraft={savedType === "narrative"}
          />
        </div>
      ) : null}
    </div>
  );
}
