import { useFetcher } from "react-router";

import { ClinicalSummaryCard } from "~/components/clinical-summary";
import type { SoapPluginCardProps } from "~/lib/soap-plugins/types";

type SummaryFetcherData = {
  summary: import("~/lib/clinical-summary.server").ClinicalSummary | null;
};

export function AiSummaryCard(props: SoapPluginCardProps) {
  const fetcher = useFetcher<SummaryFetcherData>();
  const isLoading = fetcher.state !== "idle";
  const requested = fetcher.state !== "idle" || fetcher.data !== undefined;
  const error = requested && fetcher.state === "idle" && fetcher.data === undefined;

  return (
    <div className="space-y-3">
      <ClinicalSummaryCard
        error={error}
        isLoading={isLoading}
        soapNoteCount={props.soapNoteCount}
        summary={fetcher.data?.summary ?? null}
      />
      {props.soapNoteCount > 0 && !requested ? (
        <div className="flex justify-end">
          <button
            className="button-secondary"
            onClick={() => fetcher.load(`/patients/${props.patientId}/summary`)}
            type="button"
          >
            Gerar resumo
          </button>
        </div>
      ) : null}
    </div>
  );
}
