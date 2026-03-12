import type { AuthUser, SoapNote } from "@prisma/client";

import { formatDateTime } from "~/lib/utils";

type SoapHistoryItem = SoapNote & {
  author: AuthUser;
};

export function SoapHistory(props: { notes: SoapHistoryItem[] }) {
  return (
    <details className="panel p-5">
      <summary className="cursor-pointer list-none text-lg font-semibold">
        Previous records ({props.notes.length})
      </summary>
      <div className="mt-4 space-y-4">
        {props.notes.length ? (
          props.notes.map((note) => (
            <article
              className="rounded-2xl border border-black/5 bg-white/40 p-4 dark:border-white/10 dark:bg-slate-950/30"
              key={note.id}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{formatDateTime(note.encounteredAt)}</h3>
                <span className="text-sm text-[color:var(--muted)]">
                  {note.author.fullName}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <section>
                  <h4 className="field-label">Subjective</h4>
                  <p className="whitespace-pre-wrap text-sm">{note.subjective}</p>
                </section>
                <section>
                  <h4 className="field-label">Objective</h4>
                  <p className="whitespace-pre-wrap text-sm">{note.objective}</p>
                </section>
                <section>
                  <h4 className="field-label">Assessment</h4>
                  <p className="whitespace-pre-wrap text-sm">{note.assessment}</p>
                </section>
                <section>
                  <h4 className="field-label">Plan</h4>
                  <p className="whitespace-pre-wrap text-sm">{note.plan}</p>
                </section>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            No prior SOAP records for this patient.
          </p>
        )}
      </div>
    </details>
  );
}
