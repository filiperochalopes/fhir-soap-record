import { useState } from "react";

import { ClinicalSummaryCard } from "~/components/clinical-summary";
import type { SoapPluginCardProps } from "~/lib/soap-plugins/types";

type SummaryResponse = {
  summary: import("~/lib/clinical-summary.server").ClinicalSummary | null;
};

type SummaryState = "idle" | "loading" | "done" | "error";

export function AiSummaryCard(props: SoapPluginCardProps) {
  const [state, setState] = useState<SummaryState>("idle");
  const [summary, setSummary] = useState<SummaryResponse["summary"]>(null);

  // Plain fetch with explicit error handling: a network failure generating the
  // summary must not bubble to the route ErrorBoundary and unmount the form.
  async function generate() {
    setState("loading");
    try {
      const response = await fetch(`/patients/${props.patientId}/summary`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/json")) {
        setState("error");
        return;
      }
      const payload = (await response.json()) as SummaryResponse;
      setSummary(payload.summary ?? null);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <ClinicalSummaryCard
      canGenerate={props.soapNoteCount > 0 && state === "idle"}
      error={state === "error"}
      isLoading={state === "loading"}
      onGenerate={() => void generate()}
      soapNoteCount={props.soapNoteCount}
      summary={summary}
    />
  );
}
