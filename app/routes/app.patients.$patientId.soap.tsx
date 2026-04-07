import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { ZodError } from "zod";

import { ClinicalHistory } from "~/components/clinical-history";
import { requireUserSession } from "~/lib/auth.server";
import { normalizeNarrativeSections } from "~/lib/narrative-notes";
import { createNarrativeNote, getPatientNarrativeNotes } from "~/lib/narrative-notes.server";
import { prisma } from "~/lib/prisma.server";
import { createSoapNote, getPatientSoapNotes } from "~/lib/soap-notes.server";
import { parseNarrativeForm } from "~/lib/validation/narrative";
import { parseSoapForm } from "~/lib/validation/soap";
import { formatDate, toDateTimeLocalValue } from "~/lib/utils";

export async function loader({
  params,
  request,
}: {
  params: { patientId?: string };
  request: Request;
}) {
  await requireUserSession(request);

  const patientId = Number(params.patientId);
  const patient = await prisma.patient.findUnique({
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
  });

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
    patient,
    previousNotes,
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
  const patient = await prisma.patient.findUnique({
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
  });

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
      const input = parseNarrativeForm(formData);
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
      const input = parseSoapForm(formData);
      await createSoapNote({
        ...input,
        authorUserId: auth.user.id,
        patientId: Number(params.patientId),
      });
    }

    throw redirect(`/patients/${params.patientId}/soap`);
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
  const { patient, previousNotes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

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

      <ClinicalHistory notes={previousNotes} />

      {actionData?.error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {actionData.error}
        </p>
      ) : null}

      {patient.active ? (
        <div className="grid gap-6 xl:grid-cols-2">
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
                  defaultValue={toDateTimeLocalValue(new Date())}
                  name="encounteredAt"
                  required
                  type="datetime-local"
                />
              </label>
              <label className="block">
                <span className="field-label">Subjective</span>
                <textarea name="subjective" required />
              </label>
              <label className="block">
                <span className="field-label">Objective</span>
                <textarea name="objective" required />
              </label>
              <label className="block">
                <span className="field-label">Assessment</span>
                <textarea name="assessment" required />
              </label>
              <label className="block">
                <span className="field-label">Plan</span>
                <textarea name="plan" required />
              </label>
              <div className="flex justify-end">
                <button className="button-primary" type="submit">
                  Save SOAP note
                </button>
              </div>
            </Form>
          </section>

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
                  defaultValue={toDateTimeLocalValue(new Date())}
                  name="encounteredAt"
                  required
                  type="datetime-local"
                />
              </label>
              <label className="block">
                <span className="field-label">Title</span>
                <input name="title" placeholder="Optional note title" />
              </label>
              <label className="block">
                <span className="field-label">Narrative</span>
                <textarea name="body" required />
              </label>
              <div className="flex justify-end">
                <button className="button-primary" type="submit">
                  Save narrative note
                </button>
              </div>
            </Form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
