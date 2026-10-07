import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PluginCard } from "~/components/soap-plugins/PluginCard";
import type { ClinicalSummary } from "~/lib/clinical-summary.server";

function SummarySection(props: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-violet-500/15 bg-white/45 p-4 dark:bg-slate-950/30">
      <h4 className="field-label text-violet-700 dark:text-violet-200">{props.title}</h4>
      <div className="mt-2 text-sm leading-6 text-[color:var(--page-ink)]">{props.children}</div>
    </section>
  );
}

export function ClinicalSummaryCard(props: {
  canGenerate?: boolean;
  error?: boolean;
  isLoading?: boolean;
  onGenerate?: () => void;
  soapNoteCount: number;
  summary: ClinicalSummary | null;
}) {
  const { t } = useTranslation();
  const showGenerateButton = Boolean(props.canGenerate && props.onGenerate);

  return (
    <PluginCard
      badge={t("clinicalSummary.badge", { count: props.soapNoteCount })}
      description={t("clinicalSummary.description")}
      label={t("clinicalSummary.label")}
      title={t("clinicalSummary.title")}
      tone="violet"
    >
      {!props.soapNoteCount ? (
        <p className="text-sm text-[color:var(--muted)]">
          {t("clinicalSummary.empty")}
        </p>
      ) : props.isLoading ? (
        <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
          <div className="summary-shimmer h-5 w-56 rounded-full" />
          <p className="mt-4 text-sm font-medium text-violet-800 dark:text-violet-100">
            {t("clinicalSummary.loading")}
          </p>
          <div className="mt-4 space-y-3">
            <div className="summary-shimmer h-20 rounded-2xl" />
            <div className="summary-shimmer h-16 rounded-2xl" />
            <div className="summary-shimmer h-16 rounded-2xl" />
          </div>
        </div>
      ) : props.error ? (
        <p className="text-sm text-[color:var(--muted)]">
          Falha ao gerar o resumo. Tente novamente.
        </p>
      ) : props.summary ? (
        <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
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
      ) : null}

      {showGenerateButton ? (
        <div className="mt-6 flex justify-end">
          <button
            className="button-tonal-violet"
            disabled={props.isLoading}
            onClick={props.onGenerate}
            type="button"
          >
            {props.isLoading ? "Gerando..." : "Gerar resumo"}
          </button>
        </div>
      ) : null}
    </PluginCard>
  );
}
