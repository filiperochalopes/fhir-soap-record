import { Form, Link, redirect, useActionData } from "react-router";
import { ZodError } from "zod";

import {
  PatientFormEditor,
  type PatientFormValues,
} from "~/components/patient-form-editor";
import { requireUserSession } from "~/lib/auth.server";
import { savePatient } from "~/lib/patients.server";
import { parsePatientForm } from "~/lib/validation/patients";

const emptyValues: PatientFormValues = {
  birthDate: "",
  contacts: [{ name: "", relationship: "" }],
  gender: "female",
  identifiers: [{ left: "", right: "" }],
  name: "",
  telecom: [{ left: "", right: "" }],
};

export async function action({ request }: { request: Request }) {
  const auth = await requireUserSession(request);
  const formData = await request.formData();

  try {
    const input = parsePatientForm(formData);
    const patient = await savePatient(input, auth.user.id);
    throw redirect(`/patients/${patient.id}/edit`);
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
      error: "Could not save the patient. Check duplicated identifiers.",
    };
  }
}

export default function NewPatientRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
            Patient create
          </p>
          <h2 className="mt-2 text-3xl font-semibold">New patient</h2>
        </div>
        <Link className="button-secondary" to="/patients">
          Back
        </Link>
      </div>
      {actionData?.error ? (
        <p className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm">
          {actionData.error}
        </p>
      ) : null}
      <Form className="mt-8 space-y-8" method="post">
        <PatientFormEditor initialValues={emptyValues} />
        <div className="flex justify-end">
          <button className="button-primary" type="submit">
            Save patient
          </button>
        </div>
      </Form>
    </section>
  );
}

