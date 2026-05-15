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

export type AnonymizedTextInput = {
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
};

export type AnonymizedTextResult = {
  text: string;
  ageLabel: string;
  sex: string;
} | null;

export function buildAnonymizedSoapText(input: AnonymizedTextInput): AnonymizedTextResult {
  const ageLabel = formatPatientAge(input.patient.birthDate, { now: input.now });
  if (!ageLabel) {
    return null;
  }

  const now = input.now ?? new Date();
  const lines: string[] = [];

  lines.push(`Paciente: ${ageLabel}, sexo ${input.patient.gender}`);

  if (input.current) {
    const d = scrubDraft(input.current);
    if (d.subjective) lines.push(`\nSubjetivo:\n${d.subjective}`);
    if (d.objective) lines.push(`\nObjetivo:\n${d.objective}`);
    if (d.assessment) lines.push(`\nAssessment:\n${d.assessment}`);
    if (d.plan) lines.push(`\nPlano:\n${d.plan}`);
  }

  if (input.history?.length) {
    lines.push("\n--- Histórico anterior ---");
    for (const entry of input.history) {
      const encounteredAt = new Date(entry.encounteredAt);
      const daysAgo = Math.max(
        0,
        Math.floor((now.getTime() - encounteredAt.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const d = scrubDraft(entry);
      const parts = [`\n[${daysAgo} dias atrás]`];
      if (d.subjective) parts.push(`S: ${d.subjective}`);
      if (d.objective) parts.push(`O: ${d.objective}`);
      if (d.assessment) parts.push(`A: ${d.assessment}`);
      if (d.plan) parts.push(`P: ${d.plan}`);
      lines.push(parts.join("\n"));
    }
  }

  return { text: lines.join("\n"), ageLabel, sex: input.patient.gender };
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
