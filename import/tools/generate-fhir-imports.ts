import { createHash } from "node:crypto";
import { openAsBlob } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { toFhirNarrativeDiv } from "../../app/lib/utils";

type LegacyIdentifier = {
  system: string;
  value: string;
};

type LegacyContactPoint = {
  system: string;
  value: string;
};

type LegacyContact = {
  name: string;
  relationship: string;
};

type LegacyAppointment = {
  id: number;
  start: string;
  end: string;
  status: string;
  appointmentType: string;
};

type LegacyPatient = {
  id: number;
  name: string;
  gender: string;
  birthDate: string;
  createdAt: string;
  updatedAt: string;
  identifiers: LegacyIdentifier[];
  contactPoints: LegacyContactPoint[];
  contacts: LegacyContact[];
  appointments: LegacyAppointment[];
};

type LegacyDbExport = {
  patients: LegacyPatient[];
};

type AuditBlockReference = {
  heading: string;
  startLine: number;
  topLevelDate: string | null;
};

type ImportPatient = LegacyPatient & {
  source: "db" | "synthetic";
  syntheticAuditBlocks?: AuditBlockReference[];
};

type ParsedHeading = {
  birthDate: string | null;
  displayName: string;
  raw: string;
};

type MarkdownPatientBlock = {
  body: string;
  heading: ParsedHeading;
  topLevelDate: string | null;
  startLine: number;
};

type EncounterKind = "initial" | "return" | "follow_up" | "unknown";

type MarkdownEncounter = {
  encounterDate: string | null;
  encounterKind: EncounterKind;
  encounterTime: string | null;
  rawText: string;
  sourceLabel: string;
  sourceLine: number;
};

type StructuredSoap = {
  assessment: string;
  confidence: number;
  encounterKind: EncounterKind;
  objective: string;
  plan: string;
  subjective: string;
};

type MistralOcrCache = {
  createdAt: string;
  model: string;
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
  sourceFile: string;
};

type DocumentPageExtraction = {
  confidence: number;
  discard: boolean;
  documentType: string;
  issueDate: string;
  patientBirthDate: string;
  patientName: string;
  summary: string;
};

type MatchCandidate = {
  birthDateMatched: boolean;
  completenessScore: number;
  patient: ImportPatient;
  score: number;
};

type MatchResult = {
  accepted: boolean;
  candidates: MatchCandidate[];
};

type MatchedMarkdownBlock = MarkdownPatientBlock & {
  match: MatchResult;
};

type MatchedDocumentPage = {
  extraction: DocumentPageExtraction;
  match: MatchResult;
  pageNumber: number;
  text: string;
};

type SoapCacheRecord = {
  createdAt: string;
  result: StructuredSoap;
};

type DocumentCacheRecord = {
  createdAt: string;
  result: DocumentPageExtraction;
};

type CliOptions = {
  forceLm: boolean;
  forceOcr: boolean;
  limit: number | null;
  patientFilter: string | null;
  skipLm: boolean;
  skipOcr: boolean;
};

type FhirBundle = {
  entry: Array<{
    fullUrl?: string;
    resource: Record<string, unknown>;
  }>;
  resourceType: "Bundle";
  type: "transaction";
};

const IMPORT_DIR = path.resolve(process.cwd(), "import");
const CACHE_DIR = path.join(IMPORT_DIR, "cache");
const OUT_DIR = path.join(IMPORT_DIR, "out");
const DB_JSON_PATH = path.join(IMPORT_DIR, "db_patients.json");
const MARKDOWN_PATH = path.join(IMPORT_DIR, "Clinica Cuidar - Registro.md");
const DOCUMENTS_PDF_PATH = path.join(IMPORT_DIR, "Documentos_Medicos.pdf");
const OCR_CACHE_PATH = path.join(CACHE_DIR, "documentos-medicos.ocr.json");
const SOAP_CACHE_PATH = path.join(CACHE_DIR, "soap-structuring.json");
const DOCUMENT_PAGE_CACHE_PATH = path.join(CACHE_DIR, "document-page-extractions.json");

const MISTRAL_API_BASE_URL =
  process.env.MISTRAL_API_BASE_URL?.replace(/\/+$/, "") || "https://api.mistral.ai";
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
const MISTRAL_OCR_MODEL = process.env.MISTRAL_OCR_MODEL || "mistral-ocr-latest";
const ANTHROPIC_API_BASE_URL =
  process.env.ANTHROPIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.anthropic.com";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_API_VERSION = process.env.ANTHROPIC_API_VERSION || "2023-06-01";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const CLINIC_TIMEZONE_OFFSET = process.env.CLINIC_TIMEZONE_OFFSET || "-03:00";

const NAME_STOPWORDS = new Set(["da", "das", "de", "do", "dos", "e"]);
const DOCUMENT_TYPE_ALLOWLIST = [
  "Prescrição",
  "Orientação ao paciente",
  "Solicitação de exame",
  "Atestado",
  "Encaminhamento",
  "Outro",
  "Nenhum",
] as const;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    forceLm: false,
    forceOcr: false,
    limit: null,
    patientFilter: null,
    skipLm: false,
    skipOcr: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      printHelpAndExit();
    }

    if (argument === "--skip-lm") {
      options.skipLm = true;
      continue;
    }

    if (argument === "--skip-ocr") {
      options.skipOcr = true;
      continue;
    }

    if (argument === "--force-lm") {
      options.forceLm = true;
      continue;
    }

    if (argument === "--force-ocr") {
      options.forceOcr = true;
      continue;
    }

    if (argument === "--patient") {
      options.patientFilter = argv[index + 1]?.trim() || null;
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      const rawValue = argv[index + 1];
      const parsed = rawValue ? Number(rawValue) : NaN;
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
      continue;
    }
  }

  return options;
}

function printHelpAndExit() {
  console.log(`Usage: pnpm import:generate [options]

Options:
  --patient "<nome>"   Gera bundles apenas para pacientes cujo nome contenha esse texto
  --limit N            Limita a quantidade de bundles gerados
  --skip-ocr           Não chama o OCR da Mistral; reutiliza cache se existir
  --skip-lm            Não chama o LM da Anthropic; usa apenas heurísticas
  --force-ocr          Ignora cache do OCR e executa novamente
  --force-lm           Ignora cache do chat e executa novamente
  --help               Mostra esta ajuda

Env vars:
  MISTRAL_API_KEY             OCR only
  MISTRAL_OCR_MODEL        default: mistral-ocr-latest
  MISTRAL_API_BASE_URL     default: https://api.mistral.ai
  ANTHROPIC_API_KEY        LM only
  ANTHROPIC_MODEL          default: claude-sonnet-4-20250514
  ANTHROPIC_API_BASE_URL   default: https://api.anthropic.com
  ANTHROPIC_API_VERSION    default: 2023-06-01
  CLINIC_TIMEZONE_OFFSET   default: -03:00
`);
  process.exit(0);
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u200b/g, " ")
    .replace(/[*_`]/g, " ")
    .replace(/\\-/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNameForMatch(value: string) {
  return stripAccents(normalizeWhitespace(value))
    .toLowerCase()
    .replace(/[()[\],.;:/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(value: string) {
  return normalizeNameForMatch(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !NAME_STOPWORDS.has(part));
}

function extractFirstBrazilianDate(value: string) {
  const match = normalizeWhitespace(value).match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
  return match ? normalizeBrazilianDate(match[1]) : null;
}

function normalizeBrazilianDate(rawDate: string) {
  const match = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, rawYear] = match;
  const year =
    rawYear.length === 2
      ? String(Number(rawYear) >= 70 ? 1900 + Number(rawYear) : 2000 + Number(rawYear))
      : rawYear;

  return `${year}-${month}-${day}`;
}

function toBrazilianDate(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return isoDate;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function buildIsoDateTime(date: string, time: string | null) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  const [, year, month, day] = match;
  const normalizedTime = time && /^\d{1,2}:\d{2}$/.test(time) ? time : "12:00";
  const [hour, minute] = normalizedTime.split(":");
  const paddedHour = hour.padStart(2, "0");
  return new Date(
    `${year}-${month}-${day}T${paddedHour}:${minute}:00${CLINIC_TIMEZONE_OFFSET}`,
  ).toISOString();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function readJsonFileIfExists<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return await readJsonFile<T>(filePath);
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sanitizeFilename(value: string) {
  const normalized = stripAccents(value)
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "Paciente";
}

function parseHeading(rawHeading: string): ParsedHeading {
  const cleaned = normalizeWhitespace(rawHeading);
  const birthDate = extractFirstBrazilianDate(cleaned);

  const displayName = cleaned
    .replace(/\bDN\b/gi, " ")
    .replace(/\bCPF\b\s*[\d.\-]+/gi, " ")
    .replace(/\(\s*\d{2}\/\d{2}\/\d{2,4}\s*\)/g, " ")
    .replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{1,3}\s+anos?\b/gi, " ")
    .replace(/\s+-\s+.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    birthDate,
    displayName,
    raw: cleaned,
  };
}

function parseMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: MarkdownPatientBlock[] = [];
  let currentTopDate: string | null = null;
  let currentBlock: {
    heading: ParsedHeading;
    lines: string[];
    startLine: number;
    topLevelDate: string | null;
  } | null = null;

  const flush = () => {
    if (!currentBlock) {
      return;
    }

    const body = currentBlock.lines.join("\n").trim();
    if (currentBlock.heading.displayName) {
      blocks.push({
        body,
        heading: currentBlock.heading,
        startLine: currentBlock.startLine,
        topLevelDate: currentBlock.topLevelDate,
      });
    }

    currentBlock = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const topLevelMatch = line.match(/^##\s+(.+?)\s*$/);
    if (topLevelMatch) {
      flush();
      currentTopDate = extractFirstBrazilianDate(topLevelMatch[1]);
      continue;
    }

    const patientMatch = line.match(/^###\s*(.*?)\s*$/);
    if (patientMatch) {
      flush();
      const heading = parseHeading(patientMatch[1]);
      if (!heading.displayName) {
        currentBlock = null;
        continue;
      }

      currentBlock = {
        heading,
        lines: [],
        startLine: index + 1,
        topLevelDate: currentTopDate,
      };
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  flush();
  return blocks;
}

type InternalPatientRecord = {
  normalizedName: string;
  patient: ImportPatient;
  tokens: string[];
};

function toImportPatient(patient: LegacyPatient): ImportPatient {
  return {
    ...patient,
    source: "db",
  };
}

function buildPatientIndex(patients: ImportPatient[]): InternalPatientRecord[] {
  return patients.map((patient) => ({
    normalizedName: normalizeNameForMatch(patient.name),
    patient,
    tokens: tokenizeName(patient.name),
  }));
}

function patientCompletenessScore(patient: ImportPatient) {
  return (
    patient.identifiers.length * 5 +
    patient.contactPoints.length * 3 +
    patient.contacts.length * 2 +
    patient.appointments.length * 2 +
    (patient.gender !== "unknown" ? 1 : 0) +
    (patient.source === "db" ? 1 : 0)
  );
}

function scorePatientCandidate(
  normalizedHint: string,
  hintTokens: string[],
  birthDateHint: string | null,
  record: InternalPatientRecord,
) {
  const distance = levenshteinDistance(normalizedHint, record.normalizedName);
  const maxLength = Math.max(normalizedHint.length, record.normalizedName.length, 1);
  const editScore = 1 - distance / maxLength;
  const diceScore = diceCoefficient(normalizedHint, record.normalizedName);
  const tokenScore = tokenSimilarity(hintTokens, record.tokens);
  const containsScore =
    normalizedHint && record.normalizedName.includes(normalizedHint)
      ? 1
      : record.normalizedName && normalizedHint.includes(record.normalizedName)
        ? 1
        : 0;
  const birthDateMatched = Boolean(birthDateHint && record.patient.birthDate === birthDateHint);
  const score = Math.min(
    1,
    editScore * 0.35 +
      diceScore * 0.3 +
      tokenScore * 0.25 +
      containsScore * 0.1 +
      (birthDateMatched ? 0.2 : 0),
  );

  return {
    birthDateMatched,
    completenessScore: patientCompletenessScore(record.patient),
    patient: record.patient,
    score,
  };
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return left === right ? 1 : 0;
  }

  const bigrams = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    bigrams.set(pair, (bigrams.get(pair) || 0) + 1);
  }

  let intersections = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = bigrams.get(pair) || 0;
    if (count > 0) {
      bigrams.set(pair, count - 1);
      intersections += 1;
    }
  }

  return (2 * intersections) / (left.length + right.length - 2);
}

function tokenSimilarity(leftTokens: string[], rightTokens: string[]) {
  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function matchPatientByName(
  nameHint: string,
  birthDateHint: string | null,
  patientIndex: InternalPatientRecord[],
): MatchResult {
  const normalizedHint = normalizeNameForMatch(nameHint);
  const hintTokens = tokenizeName(nameHint);

  const candidates = patientIndex
    .map((record) => scorePatientCandidate(normalizedHint, hintTokens, birthDateHint, record))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.completenessScore !== left.completenessScore) {
        return right.completenessScore - left.completenessScore;
      }

      return right.patient.id - left.patient.id;
    })
    .slice(0, 5);

  const best = candidates[0];
  const second = candidates[1];
  const sameNameAndBirthDateAsSecond =
    Boolean(best && second) &&
    normalizeNameForMatch(best.patient.name) === normalizeNameForMatch(second.patient.name) &&
    best.patient.birthDate === second.patient.birthDate;
  const completenessBreaksTie =
    sameNameAndBirthDateAsSecond &&
    Boolean(best && second) &&
    best.completenessScore > second.completenessScore;
  const accepted =
    Boolean(best) &&
    best.score >= 0.8 &&
    (!second ||
      best.score - second.score >= 0.05 ||
      best.birthDateMatched ||
      completenessBreaksTie);

  return {
    accepted,
    candidates,
  };
}

function createSyntheticPatientsFromMarkdown(blocks: MatchedMarkdownBlock[]) {
  const syntheticPatients: ImportPatient[] = [];
  let nextSyntheticId = -1;

  for (const block of blocks) {
    if (block.match.accepted || !block.heading.birthDate || !block.heading.displayName) {
      continue;
    }

    const syntheticIndex = buildPatientIndex(syntheticPatients);
    const normalizedHint = normalizeNameForMatch(block.heading.displayName);
    const hintTokens = tokenizeName(block.heading.displayName);
    const best = syntheticIndex
      .map((record) =>
        scorePatientCandidate(normalizedHint, hintTokens, block.heading.birthDate, record),
      )
      .sort((left, right) => right.score - left.score)[0];

    const auditBlock: AuditBlockReference = {
      heading: block.heading.raw,
      startLine: block.startLine,
      topLevelDate: block.topLevelDate,
    };

    if (best && best.birthDateMatched && best.score >= 0.75) {
      if (!best.patient.syntheticAuditBlocks) {
        best.patient.syntheticAuditBlocks = [];
      }
      best.patient.syntheticAuditBlocks.push(auditBlock);
      continue;
    }

    syntheticPatients.push({
      appointments: [],
      birthDate: block.heading.birthDate,
      contactPoints: [],
      contacts: [],
      createdAt: new Date().toISOString(),
      gender: "unknown",
      id: nextSyntheticId,
      identifiers: [],
      name: block.heading.displayName.trim(),
      source: "synthetic",
      syntheticAuditBlocks: [auditBlock],
      updatedAt: new Date().toISOString(),
    });
    nextSyntheticId -= 1;
  }

  return syntheticPatients;
}

function detectEncounterMarker(line: string) {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return null;
  }

  const directDateMatch = normalizedLine.match(
    /^(\d{2}\/\d{2}\/\d{2,4})(?:\s+(\d{1,2}:\d{2}))?(?:\s*-\s*(.+))?$/i,
  );
  if (directDateMatch) {
    const [, rawDate, rawTime, rawLabel] = directDateMatch;
    const encounterKind = inferEncounterKind(rawLabel || "");
    return {
      encounterDate: normalizeBrazilianDate(rawDate),
      encounterKind,
      encounterTime: rawTime || null,
      sourceLabel: rawLabel?.trim() || "",
    };
  }

  const labeledDateMatch = normalizedLine.match(
    /^(Retorno|Follow-up|Follow up|Nova consulta)\s+(\d{2}\/\d{2}\/\d{2,4})(?:\s+(\d{1,2}:\d{2}))?.*$/i,
  );
  if (labeledDateMatch) {
    const [, rawLabel, rawDate, rawTime] = labeledDateMatch;
    return {
      encounterDate: normalizeBrazilianDate(rawDate),
      encounterKind: inferEncounterKind(rawLabel),
      encounterTime: rawTime || null,
      sourceLabel: rawLabel,
    };
  }

  return null;
}

function inferEncounterKind(value: string): EncounterKind {
  const normalized = normalizeNameForMatch(value);
  if (normalized.includes("follow up") || normalized.includes("followup")) {
    return "follow_up";
  }

  if (normalized.includes("retorno") || normalized.includes("nova consulta")) {
    return "return";
  }

  return "unknown";
}

function splitMarkdownBlockIntoEncounters(block: MarkdownPatientBlock) {
  const lines = block.body.replace(/\r/g, "").split("\n");
  const markers: Array<{
    encounterDate: string | null;
    encounterKind: EncounterKind;
    encounterTime: string | null;
    lineIndex: number;
    sourceLabel: string;
    synthetic: boolean;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const marker = detectEncounterMarker(lines[index]);
    if (!marker) {
      continue;
    }

    markers.push({
      ...marker,
      lineIndex: index,
      synthetic: false,
    });
  }

  if (!markers.length || markers[0].lineIndex > 0) {
    markers.unshift({
      encounterDate: block.topLevelDate,
      encounterKind: "initial",
      encounterTime: null,
      lineIndex: 0,
      sourceLabel: block.topLevelDate ? `Top heading ${toBrazilianDate(block.topLevelDate)}` : "",
      synthetic: true,
    });
  }

  const encounters: MarkdownEncounter[] = [];
  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    const startLine = current.synthetic ? current.lineIndex : current.lineIndex + 1;
    const endLine = next ? next.lineIndex : lines.length;
    const rawText = lines
      .slice(startLine, endLine)
      .join("\n")
      .trim();

    if (!rawText) {
      continue;
    }

    encounters.push({
      encounterDate: current.encounterDate || block.topLevelDate,
      encounterKind: current.encounterKind === "unknown" && index === 0 ? "initial" : current.encounterKind,
      encounterTime: current.encounterTime,
      rawText,
      sourceLabel: current.sourceLabel,
      sourceLine: block.startLine + current.lineIndex,
    });
  }

  return encounters;
}

function heuristicSoapSections(rawText: string): StructuredSoap {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const buckets: Record<"assessment" | "objective" | "plan" | "subjective", string[]> = {
    assessment: [],
    objective: [],
    plan: [],
    subjective: [],
  };
  const prelude: string[] = [];

  let currentSection: keyof typeof buckets | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const match = line.match(
      /^\s*(S|Subjective|Subjetivo|O|Objective|Objetivo|A|Assessment|Avaliacao|Avaliação|P|Plan|Plano|Conduta|R)\s*:\s*(.*)$/i,
    );

    if (match) {
      const [, label, content] = match;
      currentSection = mapSoapLabel(label);
      if (content.trim()) {
        buckets[currentSection].push(content.trim());
      }
      continue;
    }

    if (currentSection) {
      buckets[currentSection].push(line);
    } else {
      prelude.push(line);
    }
  }

  if (!buckets.subjective.length && prelude.some((line) => line.trim())) {
    buckets.subjective.push(prelude.join("\n").trim());
  }

  return {
    assessment: buckets.assessment.join("\n").trim(),
    confidence: 0.35,
    encounterKind: "unknown",
    objective: buckets.objective.join("\n").trim(),
    plan: buckets.plan.join("\n").trim(),
    subjective: buckets.subjective.join("\n").trim(),
  };
}

function mapSoapLabel(label: string): keyof Pick<StructuredSoap, "assessment" | "objective" | "plan" | "subjective"> {
  const normalized = normalizeNameForMatch(label);

  if (normalized === "o" || normalized === "objective" || normalized === "objetivo") {
    return "objective";
  }

  if (
    normalized === "a" ||
    normalized === "assessment" ||
    normalized === "avaliacao" ||
    normalized === "avaliaçao"
  ) {
    return "assessment";
  }

  if (
    normalized === "p" ||
    normalized === "plan" ||
    normalized === "plano" ||
    normalized === "conduta" ||
    normalized === "r"
  ) {
    return "plan";
  }

  return "subjective";
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

async function callAnthropicMessage(prompt: {
  maxTokens?: number;
  system: string;
  user: string;
}) {
  const response = await fetch(`${ANTHROPIC_API_BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": ANTHROPIC_API_VERSION,
      "x-api-key": ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      system: prompt.system,
      max_tokens: prompt.maxTokens ?? 1400,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt.user }],
        },
      ],
      model: ANTHROPIC_MODEL,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`Anthropic messages error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ text?: string; type?: string }>;
  };

  if (Array.isArray(payload.content)) {
    return payload.content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  throw new Error("Anthropic messages returned no content");
}

async function structureSoapWithLm(
  encounter: MarkdownEncounter,
  patient: LegacyPatient,
  cache: Record<string, SoapCacheRecord>,
  options: CliOptions,
) {
  const cacheKey = hashValue(
    JSON.stringify({
      encounter,
      model: ANTHROPIC_MODEL,
      patientBirthDate: patient.birthDate,
      patientName: patient.name,
    }),
  );

  if (!options.forceLm && cache[cacheKey]) {
    return cache[cacheKey].result;
  }

  const fallback = {
    ...heuristicSoapSections(encounter.rawText),
    encounterKind: encounter.encounterKind === "unknown" ? "unknown" : encounter.encounterKind,
  } satisfies StructuredSoap;

  if (options.skipLm || !ANTHROPIC_API_KEY) {
    cache[cacheKey] = {
      createdAt: new Date().toISOString(),
      result: fallback,
    };
    return fallback;
  }

  const responseText = await callAnthropicMessage({
    maxTokens: 1200,
    system: [
      "Você estrutura registros clínicos em SOAP.",
      "Responda apenas JSON válido.",
      "Não invente fatos.",
      "Use string vazia quando uma seção não estiver presente.",
      "Preserve o texto em português e mantenha exames, medicamentos e orientações na seção mais apropriada.",
      'O JSON deve ter exatamente estas chaves: subjective, objective, assessment, plan, encounterKind, confidence.',
      'encounterKind deve ser um de: "initial", "return", "follow_up", "unknown".',
      "confidence deve ser um número entre 0 e 1.",
    ].join(" "),
    user: JSON.stringify(
      {
        encounter,
        fallback,
        patient: {
          birthDate: patient.birthDate,
          name: patient.name,
        },
      },
      null,
      2,
    ),
  });

  const parsed = safeJsonParse<Partial<StructuredSoap>>(
    extractJsonFromModelOutput(responseText),
    fallback,
  );
  const result: StructuredSoap = {
    assessment: typeof parsed.assessment === "string" ? parsed.assessment.trim() : fallback.assessment,
    confidence:
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : fallback.confidence,
    encounterKind:
      parsed.encounterKind === "initial" ||
      parsed.encounterKind === "return" ||
      parsed.encounterKind === "follow_up" ||
      parsed.encounterKind === "unknown"
        ? parsed.encounterKind
        : fallback.encounterKind,
    objective: typeof parsed.objective === "string" ? parsed.objective.trim() : fallback.objective,
    plan: typeof parsed.plan === "string" ? parsed.plan.trim() : fallback.plan,
    subjective:
      typeof parsed.subjective === "string" ? parsed.subjective.trim() : fallback.subjective,
  };

  cache[cacheKey] = {
    createdAt: new Date().toISOString(),
    result,
  };
  return result;
}

async function uploadPdfToMistral(filePath: string) {
  const formData = new FormData();
  formData.append("purpose", "ocr");
  formData.append("file", await openAsBlob(filePath), path.basename(filePath));

  const response = await fetch(`${MISTRAL_API_BASE_URL}/v1/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: formData,
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`Mistral upload error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("Mistral upload did not return a file id");
  }

  return payload.id;
}

async function getMistralSignedUrl(fileId: string) {
  const response = await fetch(`${MISTRAL_API_BASE_URL}/v1/files/${fileId}/url`, {
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`Mistral signed URL error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Mistral signed URL response did not include an URL");
  }

  return payload.url;
}

async function processOcrWithMistral(documentUrl: string) {
  const response = await fetch(`${MISTRAL_API_BASE_URL}/v1/ocr`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document: {
        document_url: documentUrl,
        type: "document_url",
      },
      include_image_base64: false,
      model: MISTRAL_OCR_MODEL,
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    throw new Error(`Mistral OCR error ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as {
    pages?: Array<{
      markdown?: string;
      page_number?: number;
      text?: string;
    }>;
    text?: string;
  };
}

async function loadOrCreateOcrCache(options: CliOptions) {
  if (!options.forceOcr) {
    const cached = await readJsonFileIfExists<MistralOcrCache | null>(OCR_CACHE_PATH, null);
    if (cached?.pages?.length) {
      return cached;
    }
  }

  if (options.skipOcr || !MISTRAL_API_KEY) {
    return null;
  }

  console.log("Executing Mistral OCR on Documentos_Medicos.pdf...");
  const fileId = await uploadPdfToMistral(DOCUMENTS_PDF_PATH);
  const signedUrl = await getMistralSignedUrl(fileId);
  const ocrPayload = await processOcrWithMistral(signedUrl);
  const pages =
    ocrPayload.pages?.map((page, index) => ({
      pageNumber: page.page_number ?? index + 1,
      text: normalizeWhitespace(page.markdown || page.text || ""),
    })) || [];

  const cachePayload: MistralOcrCache = {
    createdAt: new Date().toISOString(),
    model: MISTRAL_OCR_MODEL,
    pages,
    sourceFile: DOCUMENTS_PDF_PATH,
  };

  await writeJsonFile(OCR_CACHE_PATH, cachePayload);
  return cachePayload;
}

async function extractDocumentPageWithLm(
  pageText: string,
  pageNumber: number,
  cache: Record<string, DocumentCacheRecord>,
  options: CliOptions,
) {
  const cacheKey = hashValue(
    JSON.stringify({
      model: ANTHROPIC_MODEL,
      pageNumber,
      pageText,
    }),
  );

  if (!options.forceLm && cache[cacheKey]) {
    return cache[cacheKey].result;
  }

  const fallback: DocumentPageExtraction = {
    confidence: 0,
    discard: true,
    documentType: "Nenhum",
    issueDate: "",
    patientBirthDate: "",
    patientName: "",
    summary: "",
  };

  if (options.skipLm || !ANTHROPIC_API_KEY || !pageText.trim()) {
    cache[cacheKey] = {
      createdAt: new Date().toISOString(),
      result: fallback,
    };
    return fallback;
  }

  const responseText = await callAnthropicMessage({
    maxTokens: 900,
    system: [
      "Você recebe texto OCR de uma única página de documento clínico.",
      "Responda apenas JSON válido.",
      "Não invente paciente nem datas.",
      "Se não houver um documento clínico útil ou não der para identificar paciente, use discard=true e strings vazias.",
      `documentType deve ser exatamente um destes valores: ${DOCUMENT_TYPE_ALLOWLIST.join(", ")}.`,
      'O JSON deve ter exatamente estas chaves: patientName, patientBirthDate, issueDate, documentType, summary, confidence, discard.',
      "patientBirthDate e issueDate devem ser YYYY-MM-DD quando identificáveis, senão string vazia.",
      "summary deve ser uma frase curta e específica sobre o conteúdo emitido nessa página.",
      "confidence deve ser um número entre 0 e 1.",
    ].join(" "),
    user: JSON.stringify(
      {
        pageNumber,
        pageText,
      },
      null,
      2,
    ),
  });

  const parsed = safeJsonParse<Partial<DocumentPageExtraction>>(
    extractJsonFromModelOutput(responseText),
    fallback,
  );

  const result: DocumentPageExtraction = {
    confidence:
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0,
    discard: Boolean(parsed.discard),
    documentType:
      typeof parsed.documentType === "string" &&
      DOCUMENT_TYPE_ALLOWLIST.includes(parsed.documentType as (typeof DOCUMENT_TYPE_ALLOWLIST)[number])
        ? parsed.documentType
        : "Nenhum",
    issueDate:
      typeof parsed.issueDate === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.test(parsed.issueDate)
        ? parsed.issueDate
        : "",
    patientBirthDate:
      typeof parsed.patientBirthDate === "string" &&
      /^(\d{4})-(\d{2})-(\d{2})$/.test(parsed.patientBirthDate)
        ? parsed.patientBirthDate
        : "",
    patientName: typeof parsed.patientName === "string" ? parsed.patientName.trim() : "",
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
  };

  cache[cacheKey] = {
    createdAt: new Date().toISOString(),
    result,
  };
  return result;
}

function bundlePatientResourceId(patient: ImportPatient) {
  return patient.source === "synthetic"
    ? `synthetic-patient-${Math.abs(patient.id)}`
    : `legacy-patient-${patient.id}`;
}

function buildPatientResource(patient: ImportPatient, patientReferenceId: string) {
  return {
    resourceType: "Patient",
    id: patientReferenceId,
    identifier: patient.identifiers.map((identifier) => ({
      system: identifier.system,
      value: identifier.value,
    })),
    name: [
      {
        text: patient.name.trim(),
      },
    ],
    gender: patient.gender,
    birthDate: patient.birthDate,
    telecom: patient.contactPoints.map((telecom) => ({
      system: telecom.system,
      value: telecom.value,
    })),
    contact: patient.contacts.map((contact) => ({
      name: { text: contact.name },
      relationship: [{ text: contact.relationship }],
    })),
    ...(patient.source === "synthetic"
      ? {
          extension: [
            {
              url: "https://fhir-soap-record.example/synthetic-patient",
              valueBoolean: true,
            },
          ],
        }
      : {}),
  };
}

function buildAppointmentResources(patient: ImportPatient, patientReference: string) {
  return patient.appointments
    .slice()
    .sort((left, right) => left.start.localeCompare(right.start))
    .map((appointment) => ({
      resourceType: "Appointment",
      id: `legacy-appointment-${appointment.id}`,
      status: appointment.status,
      start: appointment.start,
      end: appointment.end,
      appointmentType: {
        text: appointment.appointmentType,
      },
      participant: [
        {
          actor: {
            display: patient.name.trim(),
            reference: patientReference,
          },
          status: "accepted",
        },
      ],
    }));
}

function buildSoapComposition(
  patient: ImportPatient,
  patientReference: string,
  encounter: MarkdownEncounter,
  soap: StructuredSoap,
  index: number,
) {
  if (!encounter.encounterDate) {
    return null;
  }

  const identifierValue = hashValue(
    JSON.stringify({
      encounterDate: encounter.encounterDate,
      encounterTime: encounter.encounterTime,
      index,
      patientId: patient.id,
      rawText: encounter.rawText,
    }),
  );

  return {
    resourceType: "Composition",
    id: `legacy-soap-${patient.id}-${index + 1}`,
    identifier: [
      {
        system: "legacy-markdown-soap",
        value: identifierValue,
      },
    ],
    subject: {
      reference: patientReference,
    },
    date: buildIsoDateTime(encounter.encounterDate, encounter.encounterTime),
    title: "SOAP note",
    status: "final",
    type: {
      text: "SOAP note",
    },
    section: [
      {
        title: "Subjective",
        text: {
          status: "generated",
          div: toFhirNarrativeDiv(soap.subjective),
        },
      },
      {
        title: "Objective",
        text: {
          status: "generated",
          div: toFhirNarrativeDiv(soap.objective),
        },
      },
      {
        title: "Assessment",
        text: {
          status: "generated",
          div: toFhirNarrativeDiv(soap.assessment),
        },
      },
      {
        title: "Plan",
        text: {
          status: "generated",
          div: toFhirNarrativeDiv(soap.plan),
        },
      },
    ],
  };
}

function buildDocumentNarrativeText(documents: MatchedDocumentPage[]) {
  const ordered = documents
    .slice()
    .sort((left, right) => {
      const dateComparison = (left.extraction.issueDate || "").localeCompare(
        right.extraction.issueDate || "",
      );
      if (dateComparison !== 0) {
        return dateComparison;
      }

      return left.pageNumber - right.pageNumber;
    });

  const lines = ordered
    .filter((document) => !document.extraction.discard && document.extraction.summary)
    .map((document) => {
      const prefix =
        document.extraction.documentType && document.extraction.documentType !== "Nenhum"
          ? document.extraction.documentType
          : "Outro documento";
      const dateLabel = document.extraction.issueDate
        ? ` (${toBrazilianDate(document.extraction.issueDate)})`
        : "";
      return `${prefix}${dateLabel}: ${document.extraction.summary}`;
    });

  if (!lines.length) {
    return "";
  }

  return [
    "Até essa data foram emitidos os seguintes documentos para o paciente:",
    "",
    ...lines,
  ].join("\n");
}

function buildDocumentComposition(
  patient: ImportPatient,
  patientReference: string,
  documents: MatchedDocumentPage[],
  latestEncounterIso: string,
) {
  const noteText = buildDocumentNarrativeText(documents);
  if (!noteText) {
    return null;
  }

  const identifierValue = hashValue(
    JSON.stringify({
      patientId: patient.id,
      pages: documents.map((document) => ({
        pageNumber: document.pageNumber,
        summary: document.extraction.summary,
      })),
    }),
  );

  return {
    resourceType: "Composition",
    id: `legacy-documents-${patient.id}`,
    identifier: [
      {
        system: "legacy-document-summary",
        value: identifierValue,
      },
    ],
    subject: {
      reference: patientReference,
    },
    date: latestEncounterIso,
    title: "Documentos clínicos",
    status: "final",
    type: {
      text: "Narrative note",
    },
    section: [
      {
        title: "Documentos clínicos",
        text: {
          status: "generated",
          div: toFhirNarrativeDiv(noteText),
        },
      },
    ],
  };
}

function latestEncounterDateIso(
  patient: ImportPatient,
  soapEncounters: Array<{ encounter: MarkdownEncounter }>,
  documents: MatchedDocumentPage[],
) {
  const latestSoap = soapEncounters
    .filter((item) => item.encounter.encounterDate)
    .sort((left, right) =>
      buildIsoDateTime(left.encounter.encounterDate!, left.encounter.encounterTime).localeCompare(
        buildIsoDateTime(right.encounter.encounterDate!, right.encounter.encounterTime),
      ),
    )
    .at(-1);

  if (latestSoap?.encounter.encounterDate) {
    return buildIsoDateTime(latestSoap.encounter.encounterDate, latestSoap.encounter.encounterTime);
  }

  const latestAppointment = patient.appointments
    .slice()
    .sort((left, right) => left.start.localeCompare(right.start))
    .at(-1);
  if (latestAppointment) {
    return latestAppointment.start;
  }

  const latestDocument = documents
    .filter((item) => item.extraction.issueDate)
    .sort((left, right) => left.extraction.issueDate.localeCompare(right.extraction.issueDate))
    .at(-1);
  if (latestDocument?.extraction.issueDate) {
    return buildIsoDateTime(latestDocument.extraction.issueDate, null);
  }

  return buildIsoDateTime(patient.birthDate, null);
}

function buildBundle(
  patient: ImportPatient,
  soapEntries: Array<{ encounter: MarkdownEncounter; soap: StructuredSoap }>,
  documents: MatchedDocumentPage[],
) {
  const patientId = bundlePatientResourceId(patient);
  const patientReference = `Patient/${patientId}`;
  const patientFullUrl = `urn:uuid:${patientId}`;

  const entry: FhirBundle["entry"] = [
    {
      fullUrl: patientFullUrl,
      resource: buildPatientResource(patient, patientId),
    },
  ];

  for (const appointment of buildAppointmentResources(patient, patientFullUrl)) {
    entry.push({
      resource: appointment,
    });
  }

  soapEntries
    .slice()
    .sort((left, right) => {
      if (!left.encounter.encounterDate || !right.encounter.encounterDate) {
        return 0;
      }

      return buildIsoDateTime(
        left.encounter.encounterDate,
        left.encounter.encounterTime,
      ).localeCompare(
        buildIsoDateTime(right.encounter.encounterDate, right.encounter.encounterTime),
      );
    })
    .forEach((item, index) => {
      const composition = buildSoapComposition(
        patient,
        patientFullUrl,
        item.encounter,
        item.soap,
        index,
      );
      if (!composition) {
        return;
      }

      entry.push({
        resource: composition,
      });
    });

  const documentComposition = buildDocumentComposition(
    patient,
    patientReference,
    documents,
    latestEncounterDateIso(patient, soapEntries, documents),
  );
  if (documentComposition) {
    entry.push({
      resource: documentComposition,
    });
  }

  return {
    entry,
    resourceType: "Bundle",
    type: "transaction",
  } satisfies FhirBundle;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const lmEnabled = !options.skipLm && Boolean(ANTHROPIC_API_KEY);
  const ocrEnabled = !options.skipOcr && Boolean(MISTRAL_API_KEY);

  if (!options.skipLm && !ANTHROPIC_API_KEY) {
    console.warn(
      "ANTHROPIC_API_KEY not found in environment. LM stages will fall back to heuristics.",
    );
  }

  if (!options.skipOcr && !MISTRAL_API_KEY) {
    console.warn(
      "MISTRAL_API_KEY not found in environment. OCR stages will be skipped.",
    );
  }

  const dbExport = await readJsonFile<LegacyDbExport>(DB_JSON_PATH);
  const markdown = await readFile(MARKDOWN_PATH, "utf8");
  const databasePatients = dbExport.patients.map(toImportPatient);
  const databasePatientIndex = buildPatientIndex(databasePatients);
  const markdownBlocks = parseMarkdownBlocks(markdown);

  const initiallyMatchedBlocks: MatchedMarkdownBlock[] = markdownBlocks.map((block) => ({
    ...block,
    match: matchPatientByName(
      block.heading.displayName,
      block.heading.birthDate,
      databasePatientIndex,
    ),
  }));
  const syntheticPatients = createSyntheticPatientsFromMarkdown(initiallyMatchedBlocks);
  const allPatients = [...databasePatients, ...syntheticPatients];
  const patientIndex = buildPatientIndex(allPatients);
  const matchedBlocks: MatchedMarkdownBlock[] = markdownBlocks.map((block) => ({
    ...block,
    match: matchPatientByName(block.heading.displayName, block.heading.birthDate, patientIndex),
  }));

  const soapCache = await readJsonFileIfExists<Record<string, SoapCacheRecord>>(SOAP_CACHE_PATH, {});
  const documentCache = await readJsonFileIfExists<Record<string, DocumentCacheRecord>>(
    DOCUMENT_PAGE_CACHE_PATH,
    {},
  );

  const patientSoapEntries = new Map<
    number,
    Array<{
      encounter: MarkdownEncounter;
      soap: StructuredSoap;
    }>
  >();

  const unmatchedMarkdownBlocks = matchedBlocks
    .filter((block) => !block.match.accepted)
    .map((block) => ({
      birthDate: block.heading.birthDate,
      candidates: block.match.candidates.map((candidate) => ({
        completenessScore: candidate.completenessScore,
        patientBirthDate: candidate.patient.birthDate,
        patientName: candidate.patient.name,
        score: Number(candidate.score.toFixed(4)),
        source: candidate.patient.source,
      })),
      heading: block.heading.raw,
      startLine: block.startLine,
      topLevelDate: block.topLevelDate,
    }));

  for (const block of matchedBlocks) {
    if (!block.match.accepted) {
      continue;
    }

    const matchedPatient = block.match.candidates[0]?.patient;
    if (!matchedPatient) {
      continue;
    }

    const encounters = splitMarkdownBlockIntoEncounters(block);
    for (const encounter of encounters) {
      const soap = await structureSoapWithLm(encounter, matchedPatient, soapCache, options);
      if (!patientSoapEntries.has(matchedPatient.id)) {
        patientSoapEntries.set(matchedPatient.id, []);
      }

      patientSoapEntries.get(matchedPatient.id)?.push({
        encounter,
        soap,
      });
    }
  }

  const ocrCache = await loadOrCreateOcrCache(options);
  const matchedDocumentPages: MatchedDocumentPage[] = [];
  if (ocrCache?.pages?.length) {
    for (const page of ocrCache.pages) {
      const extraction = await extractDocumentPageWithLm(
        page.text,
        page.pageNumber,
        documentCache,
        options,
      );

      if (extraction.discard || !extraction.summary) {
        continue;
      }

      const match = matchPatientByName(
        extraction.patientName,
        extraction.patientBirthDate || null,
        patientIndex,
      );

      matchedDocumentPages.push({
        extraction,
        match,
        pageNumber: page.pageNumber,
        text: page.text,
      });
    }
  }

  const patientDocumentEntries = new Map<number, MatchedDocumentPage[]>();
  const unresolvedDocumentPages = matchedDocumentPages
    .filter((page) => !page.match.accepted)
    .map((page) => ({
      candidates: page.match.candidates.map((candidate) => ({
        completenessScore: candidate.completenessScore,
        patientBirthDate: candidate.patient.birthDate,
        patientName: candidate.patient.name,
        score: Number(candidate.score.toFixed(4)),
        source: candidate.patient.source,
      })),
      confidence: Number(page.extraction.confidence.toFixed(4)),
      documentType: page.extraction.documentType,
      issueDate: page.extraction.issueDate,
      pageNumber: page.pageNumber,
      patientBirthDate: page.extraction.patientBirthDate,
      patientName: page.extraction.patientName,
      summary: page.extraction.summary,
    }));

  matchedDocumentPages
    .filter((page) => page.match.accepted && page.match.candidates[0]?.patient)
    .forEach((page) => {
      const patientId = page.match.candidates[0].patient.id;
      if (!patientDocumentEntries.has(patientId)) {
        patientDocumentEntries.set(patientId, []);
      }

      patientDocumentEntries.get(patientId)?.push(page);
    });

  const reviewReport = {
    createdMinimalPatients: syntheticPatients.map((patient) => ({
      birthDate: patient.birthDate,
      patientId: patient.id,
      patientName: patient.name,
      sourceBlocks: patient.syntheticAuditBlocks ?? [],
    })),
    generatedAt: new Date().toISOString(),
    markdownBlocksParsed: markdownBlocks.length,
    unresolvedDocumentPages,
    unmatchedMarkdownBlocks,
  };
  await writeJsonFile(path.join(OUT_DIR, "_review.json"), reviewReport);

  const filteredPatients = allPatients.filter((patient) => {
    if (!options.patientFilter) {
      return true;
    }

    return normalizeNameForMatch(patient.name).includes(
      normalizeNameForMatch(options.patientFilter),
    );
  });

  const limitedPatients =
    options.limit && options.limit > 0 ? filteredPatients.slice(0, options.limit) : filteredPatients;

  let bundlesGenerated = 0;
  for (const patient of limitedPatients) {
    const bundle = buildBundle(
      patient,
      patientSoapEntries.get(patient.id) || [],
      patientDocumentEntries.get(patient.id) || [],
    );

    const birthDateFilename = patient.birthDate.replace(/-/g, "_");
    const filename = `${sanitizeFilename(patient.name)}_${birthDateFilename}.json`;
    await writeJsonFile(path.join(OUT_DIR, filename), bundle);
    bundlesGenerated += 1;
  }

  await writeJsonFile(SOAP_CACHE_PATH, soapCache);
  await writeJsonFile(DOCUMENT_PAGE_CACHE_PATH, documentCache);

  console.log(
    JSON.stringify(
      {
        bundlesGenerated,
        createdMinimalPatients: syntheticPatients.length,
        lmEnabled,
        ocrPages: ocrCache?.pages.length || 0,
        ocrEnabled,
        patientsSelected: limitedPatients.length,
        unresolvedDocumentPages: unresolvedDocumentPages.length,
        unmatchedMarkdownBlocks: unmatchedMarkdownBlocks.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
