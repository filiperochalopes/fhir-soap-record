import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { ZodError } from "zod";

import { SoapHistory } from "~/components/soap-history";
import { requireUserSession } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { createSoapNote, getPatientSoapNotes } from "~/lib/soap-notes.server";
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
      telecom: true,
    },
  });

  if (!patient) {
    throw new Response("Patient not found", { status: 404 });
  }

  const previousNotes = await getPatientSoapNotes(patient.id);

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

  try {
    const input = parseSoapForm(formData);
    await createSoapNote({
      ...input,
      authorUserId: auth.user.id,
      patientId: Number(params.patientId),
    });

    throw redirect(`/patients/${params.patientId}/soap`);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message ?? "Invalid SOAP note.",
      };
    }

    return {
      error: "Could not save the SOAP note.",
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
              SOAP registration
            </p>
            <h2 className="mt-2 text-3xl font-semibold">{patient.name}</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
              <span>{formatDate(patient.birthDate)}</span>
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

      <SoapHistory notes={previousNotes} />

      <section className="panel p-6">
        <div>
          <h3 className="text-2xl font-semibold">New SOAP note</h3>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Keep entries plain text for fast clinical registration.
          </p>
        </div>
        {actionData?.error ? (
          <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
            {actionData.error}
          </p>
        ) : null}
        <Form className="mt-8 space-y-5" method="post">
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
    </div>
  );
}
