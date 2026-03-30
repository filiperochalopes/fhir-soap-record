import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { ZodError } from "zod";

import {
  PatientFormEditor,
  type PatientFormValues,
} from "~/components/patient-form-editor";
import { requireUserSession } from "~/lib/auth.server";
import { savePatient } from "~/lib/patients.server";
import { prisma } from "~/lib/prisma.server";
import { parsePatientForm } from "~/lib/validation/patients";
import { toDateInputValue } from "~/lib/utils";

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

  const formValues: PatientFormValues = {
    birthDate: toDateInputValue(patient.birthDate),
    contacts: patient.contacts.map((contact) => ({
      name: contact.name,
      relationship: contact.relationship,
    })),
    gender: patient.gender.toLowerCase(),
    isDraft: patient.isDraft,
    identifiers: patient.identifier.map((identifier) => ({
      left: identifier.system,
      right: identifier.value,
    })),
    name: patient.name,
    telecom: patient.telecom.map((contactPoint) => ({
      left: contactPoint.system,
      right: contactPoint.value,
    })),
  };

  return { patient, formValues };
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
    const input = parsePatientForm(formData);
    await savePatient(input, auth.user.id, Number(params.patientId));
    throw redirect(`/patients/${params.patientId}/edit`);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message ?? "Invalid patient data.",
      };
    }

    return {
      error: "Could not update the patient. Check duplicated identifiers.",
    };
  }
}

export default function EditPatientRoute() {
  const { patient, formValues } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
            Patient edit
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-semibold">{patient.name}</h2>
            {patient.isDraft ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Draft
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button-secondary" to="/patients">
            Back
          </Link>
          <Link className="button-primary" to={`/patients/${patient.id}/soap`}>
            SOAP page
          </Link>
        </div>
      </div>
      {actionData?.error ? (
        <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {actionData.error}
        </p>
      ) : null}
      {patient.isDraft ? (
        <p className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
          This patient is pending registration completion. Fill the missing fields and uncheck
          `Draft` when the record is complete.
        </p>
      ) : null}
      <Form className="mt-8 space-y-8" method="post">
        <PatientFormEditor initialValues={formValues} />
        <div className="flex justify-end">
          <button className="button-primary" type="submit">
            Update patient
          </button>
        </div>
      </Form>
    </section>
  );
}
