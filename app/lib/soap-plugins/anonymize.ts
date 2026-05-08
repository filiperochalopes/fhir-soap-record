import { formatPatientAge } from "~/lib/utils";

export type SoapDraft = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type AnonymizedPayload = {
  ageLabel: string;
  sex: string;
  current: SoapDraft | null;
  history?: Array<SoapDraft & { daysAgo: number }>;
};

const CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}-?\d{4}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

function scrub(value: string) {
  return value
    .replace(CPF_RE, "[REMOVIDO]")
    .replace(EMAIL_RE, "[REMOVIDO]")
    .replace(PHONE_RE, "[REMOVIDO]")
    .trim();
}

function scrubDraft(draft: SoapDraft): SoapDraft {
  return {
    subjective: scrub(draft.subjective),
    objective: scrub(draft.objective),
    assessment: scrub(draft.assessment),
    plan: scrub(draft.plan),
  };
}

export function anonymizePayload(input: {
  patient: { birthDate: Date | string | null; gender: string };
  current: SoapDraft | null;
  history?: Array<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    encounteredAt: Date | string;
  }>;
  now?: Date;
}): AnonymizedPayload | null {
  const ageLabel = formatPatientAge(input.patient.birthDate, { now: input.now });
  if (!ageLabel) {
    return null;
  }

  const now = input.now ?? new Date();

  return {
    ageLabel,
    sex: input.patient.gender,
    current: input.current ? scrubDraft(input.current) : null,
    history: input.history?.length
      ? input.history.map((entry) => {
          const encounteredAt = new Date(entry.encounteredAt);
          const daysAgo = Math.max(
            0,
            Math.floor((now.getTime() - encounteredAt.getTime()) / (1000 * 60 * 60 * 24)),
          );
          return { ...scrubDraft(entry), daysAgo };
        })
      : undefined,
  };
}
