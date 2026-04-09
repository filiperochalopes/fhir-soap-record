import type { SoapNote } from "@prisma/client";

import { getDefaultTextProvider } from "~/lib/ai/provider.server";

export type ClinicalSummaryCondition = {
  context: string;
  name: string;
};

export type ClinicalSummary = {
  allergiesAndMedications: string | null;
  briefSummary: string;
  conditions: ClinicalSummaryCondition[];
  recentHistory: string | null;
};

type SummarySoapNote = Pick<
  SoapNote,
  "assessment" | "encounteredAt" | "objective" | "plan" | "subjective"
>;

type SummaryPatient = {
  birthDate: Date | null;
  gender: string;
  name: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeCondition(value: unknown): ClinicalSummaryCondition | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const context = typeof candidate.context === "string" ? candidate.context.trim() : "";

  if (!name || !context) {
    return null;
  }

  return {
    context,
    name,
  };
}

function extractJsonFromModelOutput(value: string) {
  const fenced = value.match(/```json\s*([\s\S]*?)```/i) || value.match(/```\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1).trim();
  }

  return value.trim();
}

function normalizeSummary(raw: unknown): ClinicalSummary | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const conditions = Array.isArray(candidate.conditions)
    ? candidate.conditions
        .map(normalizeCondition)
        .filter((item): item is ClinicalSummaryCondition => item !== null)
        .slice(0, 8)
    : [];

  const briefSummary =
    typeof candidate.briefSummary === "string" ? candidate.briefSummary.trim() : "";

  if (!conditions.length && !briefSummary) {
    return null;
  }

  return {
    allergiesAndMedications: normalizeOptionalText(candidate.allergiesAndMedications),
    briefSummary,
    conditions,
    recentHistory: normalizeOptionalText(candidate.recentHistory),
  };
}

export async function generateClinicalSummary(input: {
  patient: SummaryPatient;
  soapNotes: SummarySoapNote[];
}) {
  if (!input.soapNotes.length) {
    return null;
  }

  const provider = getDefaultTextProvider();
  if (!provider) {
    return null;
  }

  const soapNotes = [...input.soapNotes]
    .sort((left, right) => right.encounteredAt.getTime() - left.encounteredAt.getTime())
    .map((note) => ({
      assessment: cleanText(note.assessment),
      encounteredAt: note.encounteredAt.toISOString(),
      objective: cleanText(note.objective),
      plan: cleanText(note.plan),
      subjective: cleanText(note.subjective),
    }));

  const assessments = soapNotes.map((note, index) => ({
    assessment: note.assessment,
    encounteredAt: note.encounteredAt,
    noteNumber: index + 1,
  }));

  try {
    const responseText = await provider.generateText({
      maxTokens: 1600,
      system: [
        "Você gera um resumo clínico IPS-like em português para tela de prontuário.",
        "A seção principal é Problemas e condições.",
        "Problemas e condições deve ser derivada principalmente dos campos assessment (A) de todos os SOAPs.",
        "Ordene os problemas por prioridade clínica aparente, recorrência e contexto longitudinal.",
        "Consolide duplicatas, preserve incertezas diagnósticas e não invente fatos.",
        "Resumo clínico breve deve sintetizar o quadro longitudinal usando todos os campos SOAP.",
        "Alergias e medicações só devem ser mencionadas se estiverem explicitamente descritas nos registros.",
        "História recente deve resumir os encontros mais recentes de forma breve.",
        "Responda apenas JSON válido.",
        'Use exatamente este formato: {"conditions":[{"name":"","context":""}],"briefSummary":"","allergiesAndMedications":"","recentHistory":""}.',
        "Use strings vazias quando uma seção textual não tiver conteúdo.",
        "Cada item de conditions deve ser curto e clínico.",
      ].join(" "),
      temperature: 0,
      user: JSON.stringify(
        {
          assessments,
          patient: {
            birthDate: input.patient.birthDate?.toISOString() ?? null,
            gender: input.patient.gender,
            name: input.patient.name,
          },
          soapNotes,
        },
        null,
        2,
      ),
    });

    const parsed = JSON.parse(extractJsonFromModelOutput(responseText)) as unknown;
    return normalizeSummary(parsed);
  } catch (error) {
    console.error("Failed to generate clinical summary", error);
    return null;
  }
}
