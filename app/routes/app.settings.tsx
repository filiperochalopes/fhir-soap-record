import { useLoaderData } from "react-router";

import { ThemeToggle } from "~/components/theme-toggle";
import { requireUserSession } from "~/lib/auth.server";
import { getExportOverview } from "~/lib/export.server";

export async function loader({ request }: { request: Request }) {
  await requireUserSession(request);
  return getExportOverview();
}

export default function SettingsRoute() {
  const { counts, namespace } = useLoaderData<typeof loader>();

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
          <p className="text-sm text-[color:var(--muted)]">
            Patients are matched again by stable exported identifiers, and notes are deduplicated
            by stable source identifiers. Appointment reimports are matched by patient plus
            `start/end`.
          </p>
          <div>
            <a className="button-primary inline-flex" href="/settings/export">
              Download Full Export JSON
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
