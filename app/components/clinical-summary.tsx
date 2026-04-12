import type { ReactNode } from "react";

import type { ClinicalSummary } from "~/lib/clinical-summary.server";

function SummarySection(props: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-violet-500/15 bg-white/45 p-4 dark:bg-slate-950/30">
      <h4 className="field-label text-violet-700 dark:text-violet-200">{props.title}</h4>
      <div className="mt-2 text-sm leading-6 text-[color:var(--page-ink)]">{props.children}</div>
    </section>
  );
}

export function ClinicalSummaryCard(props: {
  error?: boolean;
  isLoading?: boolean;
  soapNoteCount: number;
  summary: ClinicalSummary | null;
}) {
  return (
    <details className="panel panel-spotlight summary-details p-6" open>
      <summary className="summary-toggle flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-200">
            AI Summary
          </p>
          <h3 className="mt-2 text-2xl font-semibold">IPS-like clinical overview</h3>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
            Built from all prior SOAP records, with priority on problems and conditions derived
            from the assessment section.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-200">
            {props.soapNoteCount} SOAP {props.soapNoteCount === 1 ? "record" : "records"}
          </div>
          <span
            aria-hidden="true"
            className="summary-toggle-icon mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200"
          >
            <svg
              fill="none"
              height="8"
              viewBox="0 0 12 8"
              width="12"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.41 7.41L6 2.83L10.59 7.41L12 6L6 0L0 6L1.41 7.41Z"
                fill="currentColor"
                fillOpacity="0.54"
              />
            </svg>
          </span>
        </div>
      </summary>

      {!props.soapNoteCount ? (
        <p className="mt-6 text-sm text-[color:var(--muted)]">
          No previous SOAP records are available to generate the summary yet.
        </p>
      ) : props.isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
            <div className="summary-shimmer h-5 w-56 rounded-full" />
            <p className="mt-4 text-sm font-medium text-violet-800 dark:text-violet-100">
              Loading IPS AI Summary...
            </p>
            <div className="mt-4 space-y-3">
              <div className="summary-shimmer h-20 rounded-2xl" />
              <div className="summary-shimmer h-16 rounded-2xl" />
              <div className="summary-shimmer h-16 rounded-2xl" />
            </div>
          </div>
        </div>
      ) : props.error ? (
        <p className="mt-6 text-sm text-[color:var(--muted)]">
          AI summary is unavailable right now. Previous SOAP records remain available below.
        </p>
      ) : !props.summary ? (
        <p className="mt-6 text-sm text-[color:var(--muted)]">
          AI summary is unavailable right now. Previous SOAP records remain available below.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_1fr]">
          <SummarySection title="Problemas e condições">
            <div className="space-y-3">
              {props.summary.conditions.length ? (
                props.summary.conditions.map((condition, index) => (
                  <article
                    className="rounded-2xl border border-violet-500/10 bg-violet-500/5 p-3"
                    key={`${condition.name}-${index}`}
                  >
                    <p className="font-semibold">{condition.name}</p>
                    <p className="mt-1 text-[color:var(--muted)]">{condition.context}</p>
                  </article>
                ))
              ) : (
                <p className="text-[color:var(--muted)]">
                  Nenhum problema ou condição pôde ser consolidado a partir dos assessments
                  anteriores.
                </p>
              )}
            </div>
          </SummarySection>

          <div className="space-y-4">
            <SummarySection title="Resumo clínico breve">
              <p className="whitespace-pre-wrap">
                {props.summary.briefSummary || "Sem resumo clínico breve disponível."}
              </p>
            </SummarySection>

            <SummarySection title="Alergias e medicações">
              <p className="whitespace-pre-wrap">
                {props.summary.allergiesAndMedications ||
                  "Sem menções explícitas de alergias ou medicações nos SOAPs analisados."}
              </p>
            </SummarySection>

            <SummarySection title="História recente">
              <p className="whitespace-pre-wrap">
                {props.summary.recentHistory ||
                  "Sem histórico recente suficiente para síntese adicional."}
              </p>
            </SummarySection>
          </div>
        </div>
      )}
    </details>
  );
}
