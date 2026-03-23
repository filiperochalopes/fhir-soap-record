import { formatDateTime } from "~/lib/utils";

type HistorySection = {
  text: string;
  title: string;
};

export type ClinicalHistoryItem = {
  author: {
    fullName: string;
  };
  encounteredAt: Date | string;
  id: string;
  kind: "narrative" | "soap";
  sections: HistorySection[];
  title: string;
};

export function ClinicalHistory(props: { notes: ClinicalHistoryItem[] }) {
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
                <div>
                  <h3 className="font-semibold">{note.title}</h3>
                  <p className="text-sm text-[color:var(--muted)]">
                    {formatDateTime(note.encounteredAt)}
                  </p>
                </div>
                <div className="text-right text-sm text-[color:var(--muted)]">
                  <div>{note.author.fullName}</div>
                  <div>{note.kind === "soap" ? "SOAP" : "Narrative"}</div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {note.sections.map((section, index) => (
                  <section key={`${note.id}-${index}`}>
                    <h4 className="field-label">{section.title}</h4>
                    <p className="whitespace-pre-wrap text-sm">{section.text}</p>
                  </section>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            No prior clinical records for this patient.
          </p>
        )}
      </div>
    </details>
  );
}
