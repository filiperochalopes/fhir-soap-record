import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

type AuditBlockReference = {
  heading: string;
  startLine: number;
  topLevelDate: string | null;
};

type ReviewCandidate = {
  completenessScore: number;
  patientBirthDate: string | null;
  patientId: number;
  patientName: string;
  score: number;
  source: "db" | "synthetic";
};

type ReviewMarkdownBlock = {
  birthDate: string | null;
  candidates: ReviewCandidate[];
  displayName: string;
  heading: string;
  startLine: number;
  topLevelDate: string | null;
};

type ReviewDocumentPage = {
  candidates: ReviewCandidate[];
  confidence: number;
  documentType: string;
  issueDate: string;
  pageNumber: number;
  patientBirthDate: string;
  patientName: string;
  summary: string;
};

type ReviewReport = {
  createdDraftPatients?: unknown[];
  createdMinimalPatients?: Array<{
    birthDate: string | null;
    createdBy?: string;
    isDraft: boolean;
    patientId: number;
    patientName: string;
    sourceBlocks?: AuditBlockReference[];
    sourcePages?: number[];
  }>;
  generatedAt: string;
  markdownBlocksParsed: number;
  unmatchedMarkdownBlocks: ReviewMarkdownBlock[];
  unresolvedDocumentPages: ReviewDocumentPage[];
};

type ManualDecisionAction = "create_synthetic" | "match_existing" | "skip";

type ManualDecisionRecord = {
  action: ManualDecisionAction;
  patientBirthDate?: string | null;
  patientId?: number;
  patientName?: string;
  updatedAt: string;
};

type ManualSyntheticPatientRecord = {
  birthDate: string | null;
  createdAt: string;
  id: number;
  isDraft: boolean;
  name: string;
  sourceBlocks?: AuditBlockReference[];
  sourcePages?: number[];
  updatedAt: string;
};

type ManualDecisions = {
  createdAt: string;
  documentIdentities: Record<string, ManualDecisionRecord>;
  documentPages: Record<string, ManualDecisionRecord>;
  markdownIdentities: Record<string, ManualDecisionRecord>;
  markdownBlocks: Record<string, ManualDecisionRecord>;
  patientNameOverrides: Record<string, { name: string; updatedAt: string }>;
  syntheticPatients: ManualSyntheticPatientRecord[];
  updatedAt: string;
};

type CliOptions = {
  includeResolved: boolean;
  limit: number | null;
  mode: "all" | "documents" | "markdown";
};

type ReviewTask =
  | { item: ReviewMarkdownBlock; key: string; kind: "markdown" }
  | { item: ReviewDocumentPage; key: string; kind: "document" };

const IMPORT_DIR = path.resolve(process.cwd(), "import");
const CACHE_DIR = path.join(IMPORT_DIR, "cache");
const OUT_DIR = path.join(IMPORT_DIR, "out");
const REVIEW_REPORT_PATH = path.join(OUT_DIR, "_review.json");
const MANUAL_DECISIONS_PATH = path.join(CACHE_DIR, "manual-decisions.json");

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    includeResolved: false,
    limit: null,
    mode: "all",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      printHelpAndExit();
    }

    if (argument === "--documents-only") {
      options.mode = "documents";
      continue;
    }

    if (argument === "--markdown-only") {
      options.mode = "markdown";
      continue;
    }

    if (argument === "--include-resolved") {
      options.includeResolved = true;
      continue;
    }

    if (argument === "--limit") {
      const rawValue = argv[index + 1];
      const parsed = rawValue ? Number(rawValue) : NaN;
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    }
  }

  return options;
}

function printHelpAndExit() {
  console.log(`Usage: pnpm import:review [options]

Options:
  --documents-only     Revisa apenas páginas de documentos pendentes
  --markdown-only      Revisa apenas blocos do Markdown pendentes
  --include-resolved   Mostra também itens que já possuem decisão manual
  --limit N            Limita a quantidade de itens revisados nesta sessão
  --help               Mostra esta ajuda

Comandos interativos:
  1..5  Vincula ao candidato correspondente
  c     Cria um paciente mínimo manual
  d     Alias para "c"
  s     Pula o item
  q     Salva e sai
  ?     Mostra ajuda dos comandos
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

function extractFirstBrazilianDate(value: string) {
  const match = normalizeWhitespace(value).match(/\b(\d{2}\/\d{2}\/\d{2,4})\b/);
  return match ? normalizeBrazilianDate(match[1]) : null;
}

function parseDisplayNameFromHeading(rawHeading: string) {
  return normalizeWhitespace(rawHeading)
    .replace(/\bDN\b/gi, " ")
    .replace(/\bCPF\b\s*[\d.\-]+/gi, " ")
    .replace(/\(\s*\d{2}\/\d{2}\/\d{2,4}\s*\)/g, " ")
    .replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{1,3}\s+anos?\b/gi, " ")
    .replace(/\s+-\s+.*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function markdownBlockDecisionKey(block: Pick<ReviewMarkdownBlock, "heading" | "startLine" | "topLevelDate">) {
  return hashValue(
    JSON.stringify({
      heading: block.heading,
      startLine: block.startLine,
      topLevelDate: block.topLevelDate,
    }),
  );
}

function documentPageDecisionKey(pageNumber: number) {
  return String(pageNumber);
}

function markdownIdentityKey(item: Pick<ReviewMarkdownBlock, "displayName" | "birthDate" | "heading">) {
  return hashValue(
    JSON.stringify({
      birthDate: item.birthDate || extractFirstBrazilianDate(item.heading) || "",
      displayName: normalizeNameForMatch(item.displayName || parseDisplayNameFromHeading(item.heading)),
    }),
  );
}

function documentIdentityKey(item: Pick<ReviewDocumentPage, "patientBirthDate" | "patientName">) {
  return hashValue(
    JSON.stringify({
      patientBirthDate: item.patientBirthDate || "",
      patientName: normalizeNameForMatch(item.patientName || ""),
    }),
  );
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

function emptyManualDecisions(): ManualDecisions {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    documentIdentities: {},
    documentPages: {},
    markdownIdentities: {},
    markdownBlocks: {},
    patientNameOverrides: {},
    syntheticPatients: [],
    updatedAt: now,
  };
}

function normalizeManualDecisions(input: Partial<ManualDecisions> | null | undefined): ManualDecisions {
  const fallback = emptyManualDecisions();
  return {
    createdAt: input?.createdAt || fallback.createdAt,
    documentIdentities: input?.documentIdentities || {},
    documentPages: input?.documentPages || {},
    markdownIdentities: input?.markdownIdentities || {},
    markdownBlocks: input?.markdownBlocks || {},
    patientNameOverrides: input?.patientNameOverrides || {},
    syntheticPatients: input?.syntheticPatients || [],
    updatedAt: input?.updatedAt || fallback.updatedAt,
  };
}

function normalizeNameForMatch(value: string) {
  return stripAccents(normalizeWhitespace(value))
    .toLowerCase()
    .replace(/[()[\],.;:/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(value: string) {
  const stopwords = new Set(["da", "das", "de", "do", "dos", "e"]);
  return normalizeNameForMatch(value)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !stopwords.has(part));
}

function nextManualSyntheticPatientId(decisions: ManualDecisions) {
  const currentMin = decisions.syntheticPatients.reduce(
    (lowest, patient) => Math.min(lowest, patient.id),
    -999999,
  );
  return currentMin <= -1000000 ? currentMin - 1 : -1000000;
}

function formatBirthDate(value: string | null | undefined) {
  return value || "pendente";
}

function candidateDisplayName(candidate: ReviewCandidate, decisions: ManualDecisions) {
  const override = decisions.patientNameOverrides[String(candidate.patientId)]?.name?.trim();
  return override || candidate.patientName;
}

function printCandidate(candidate: ReviewCandidate, index: number, decisions: ManualDecisions) {
  console.log(
    `  ${index + 1}. ${candidateDisplayName(candidate, decisions)} | DN ${formatBirthDate(candidate.patientBirthDate)} | ${candidate.source} | score ${candidate.score.toFixed(4)} | completude ${candidate.completenessScore}`,
  );
}

function printTask(
  task: ReviewTask,
  position: number,
  total: number,
  decisions: ManualDecisions,
) {
  console.log("");
  console.log(`Item ${position}/${total}`);

  if (task.kind === "markdown") {
    console.log("Tipo: bloco Markdown");
    console.log(`Nome extraído: ${task.item.displayName || parseDisplayNameFromHeading(task.item.heading)}`);
    console.log(`DN extraída: ${formatBirthDate(task.item.birthDate || extractFirstBrazilianDate(task.item.heading))}`);
    console.log(`Heading: ${task.item.heading}`);
    console.log(`Linha: ${task.item.startLine}`);
    console.log(`Data do topo: ${formatBirthDate(task.item.topLevelDate)}`);
  } else {
    console.log("Tipo: documento OCR");
    console.log(`Página: ${task.item.pageNumber}`);
    console.log(`Paciente OCR: ${task.item.patientName || "não identificado"}`);
    console.log(`DN OCR: ${formatBirthDate(task.item.patientBirthDate || null)}`);
    console.log(`Documento: ${task.item.documentType}`);
    console.log(`Resumo: ${task.item.summary}`);
    console.log(`Confiança do LM: ${task.item.confidence}`);
  }

  if (task.item.candidates.length) {
    console.log("Candidatos:");
    task.item.candidates.forEach((candidate, index) => printCandidate(candidate, index, decisions));
  } else {
    console.log("Candidatos: nenhum");
  }

  console.log('Ações: [1-5] vincular, [c] criar paciente mínimo, [s] pular, [q] sair, [?] ajuda');
}

function buildTasks(
  reviewReport: ReviewReport,
  decisions: ManualDecisions,
  options: Omit<CliOptions, "limit">,
) {
  const tasks: ReviewTask[] = [];

  if (options.mode !== "documents") {
    for (const item of reviewReport.unmatchedMarkdownBlocks) {
      const key = markdownBlockDecisionKey(item);
      if (
        !options.includeResolved &&
        (decisions.markdownBlocks[key] || decisions.markdownIdentities[markdownIdentityKey(item)])
      ) {
        continue;
      }

      tasks.push({
        item,
        key,
        kind: "markdown",
      });
    }
  }

  if (options.mode !== "markdown") {
    for (const item of reviewReport.unresolvedDocumentPages) {
      const key = documentPageDecisionKey(item.pageNumber);
      if (
        !options.includeResolved &&
        (decisions.documentPages[key] || decisions.documentIdentities[documentIdentityKey(item)])
      ) {
        continue;
      }

      tasks.push({
        item,
        key,
        kind: "document",
      });
    }
  }

  return tasks;
}

function saveDecision(
  decisions: ManualDecisions,
  task: ReviewTask,
  decision: ManualDecisionRecord,
) {
  decisions.updatedAt = new Date().toISOString();
  if (task.kind === "markdown") {
    decisions.markdownBlocks[task.key] = decision;
    decisions.markdownIdentities[markdownIdentityKey(task.item)] = decision;
    return;
  }

  decisions.documentPages[task.key] = decision;
  decisions.documentIdentities[documentIdentityKey(task.item)] = decision;
}

function effectiveDecisionForTask(decisions: ManualDecisions, task: ReviewTask) {
  if (task.kind === "markdown") {
    return decisions.markdownBlocks[task.key] || decisions.markdownIdentities[markdownIdentityKey(task.item)];
  }

  return decisions.documentPages[task.key] || decisions.documentIdentities[documentIdentityKey(task.item)];
}

function hydrateIdentityDecisions(reviewReport: ReviewReport, decisions: ManualDecisions) {
  let changed = false;

  for (const item of reviewReport.unmatchedMarkdownBlocks) {
    const pageDecision = decisions.markdownBlocks[markdownBlockDecisionKey(item)];
    const identityKey = markdownIdentityKey(item);
    if (pageDecision && !decisions.markdownIdentities[identityKey]) {
      decisions.markdownIdentities[identityKey] = pageDecision;
      changed = true;
    }
  }

  for (const item of reviewReport.unresolvedDocumentPages) {
    const pageDecision = decisions.documentPages[documentPageDecisionKey(item.pageNumber)];
    const identityKey = documentIdentityKey(item);
    if (pageDecision && !decisions.documentIdentities[identityKey]) {
      decisions.documentIdentities[identityKey] = pageDecision;
      changed = true;
    }
  }

  if (changed) {
    decisions.updatedAt = new Date().toISOString();
  }

  return changed;
}

function extractedNameForTask(task: ReviewTask) {
  return task.kind === "markdown"
    ? task.item.displayName || parseDisplayNameFromHeading(task.item.heading)
    : task.item.patientName;
}

function shouldOfferNameExpansion(candidateName: string, extractedName: string) {
  const normalizedCandidate = normalizeNameForMatch(candidateName);
  const normalizedExtracted = normalizeNameForMatch(extractedName);
  if (!normalizedCandidate || !normalizedExtracted || normalizedCandidate === normalizedExtracted) {
    return false;
  }

  const candidateTokens = tokenizeName(candidateName);
  const extractedTokens = tokenizeName(extractedName);
  if (!candidateTokens.length || !extractedTokens.length) {
    return false;
  }

  const sameLeadingToken = candidateTokens[0] === extractedTokens[0];
  const extractedIsLonger = extractedTokens.length > candidateTokens.length;
  return sameLeadingToken && extractedIsLonger;
}

async function maybeCaptureNameExpansion(
  decisions: ManualDecisions,
  rl: ReturnType<typeof createInterface>,
  patientId: number,
  candidateName: string,
  extractedName: string,
) {
  const existingOverride = decisions.patientNameOverrides[String(patientId)]?.name?.trim();
  if (existingOverride) {
    const normalizedOverride = normalizeNameForMatch(existingOverride);
    const normalizedExtracted = normalizeNameForMatch(extractedName);

    if (normalizedOverride === normalizedExtracted) {
      return;
    }

    if (!shouldOfferNameExpansion(existingOverride, extractedName)) {
      return;
    }
  }

  if (!shouldOfferNameExpansion(candidateName, extractedName)) {
    return;
  }

  const answer = normalizeWhitespace(
    await rl.question(`Expandir nome do paciente para "${extractedName}"? [y/N]: `),
  ).toLowerCase();

  if (!["y", "yes", "s", "sim"].includes(answer)) {
    return;
  }

  decisions.patientNameOverrides[String(patientId)] = {
    name: extractedName.trim(),
    updatedAt: new Date().toISOString(),
  };
  decisions.updatedAt = new Date().toISOString();
}

async function createManualSyntheticPatient(
  decisions: ManualDecisions,
  rl: ReturnType<typeof createInterface>,
  task: ReviewTask,
) {
  const defaultName =
    extractedNameForTask(task);
  const defaultBirthDate =
    task.kind === "markdown"
      ? task.item.birthDate || extractFirstBrazilianDate(task.item.heading)
      : task.item.patientBirthDate || null;

  const rawName = await rl.question(`Nome [${defaultName || "Paciente"}]: `);
  const name = normalizeWhitespace(rawName) || defaultName || "Paciente sem identificação";

  const birthDatePrompt = defaultBirthDate || "";
  const rawBirthDate = await rl.question(
    `Nascimento YYYY-MM-DD [${birthDatePrompt || "vazio"}]: `,
  );
  const normalizedBirthDate = normalizeWhitespace(rawBirthDate) || birthDatePrompt;
  const birthDate = normalizedBirthDate || null;

  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    console.log("Data inválida. Use YYYY-MM-DD ou deixe vazio.");
    return null;
  }

  const now = new Date().toISOString();
  const patientId = nextManualSyntheticPatientId(decisions);
  const syntheticPatient: ManualSyntheticPatientRecord = {
    birthDate,
    createdAt: now,
    id: patientId,
    isDraft: !birthDate,
    name,
    ...(task.kind === "markdown"
      ? {
          sourceBlocks: [
            {
              heading: task.item.heading,
              startLine: task.item.startLine,
              topLevelDate: task.item.topLevelDate,
            },
          ],
        }
      : {
          sourcePages: [task.item.pageNumber],
        }),
    updatedAt: now,
  };

  decisions.syntheticPatients.push(syntheticPatient);

  return {
    action: "create_synthetic",
    patientBirthDate: birthDate,
    patientId,
    patientName: name,
    updatedAt: now,
  } satisfies ManualDecisionRecord;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("import:review precisa de um terminal interativo (TTY).");
  }

  const reviewReport = await readJsonFile<ReviewReport>(REVIEW_REPORT_PATH);
  const decisions = normalizeManualDecisions(
    await readJsonFileIfExists<Partial<ManualDecisions>>(MANUAL_DECISIONS_PATH, {}),
  );
  if (hydrateIdentityDecisions(reviewReport, decisions)) {
    await writeJsonFile(MANUAL_DECISIONS_PATH, decisions);
  }
  const allPendingTasks = buildTasks(reviewReport, decisions, {
    includeResolved: options.includeResolved,
    mode: options.mode,
  });
  const tasks = options.limit ? allPendingTasks.slice(0, options.limit) : allPendingTasks;

  console.log(
    JSON.stringify(
      {
        generatedAt: reviewReport.generatedAt,
        manualDocumentDecisions: Object.keys(decisions.documentPages).length,
        manualMarkdownDecisions: Object.keys(decisions.markdownBlocks).length,
        manualPatientNameOverrides: Object.keys(decisions.patientNameOverrides).length,
        pendingDocumentPages: allPendingTasks.filter((task) => task.kind === "document").length,
        pendingMarkdownBlocks: allPendingTasks.filter((task) => task.kind === "markdown").length,
        sessionItems: tasks.length,
      },
      null,
      2,
    ),
  );

  if (!tasks.length) {
    console.log("Nenhum item pendente para revisar.");
    return;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let reviewedCount = 0;

  try {
    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index];

      const existingDecision = effectiveDecisionForTask(decisions, task);
      if (existingDecision) {
        saveDecision(decisions, task, existingDecision);
        await writeJsonFile(MANUAL_DECISIONS_PATH, decisions);
        continue;
      }

      while (true) {
        printTask(task, index + 1, tasks.length, decisions);
        const answer = normalizeWhitespace(await rl.question("> ")).toLowerCase();

        if (!answer || answer === "?") {
          console.log("Digite 1..5 para vincular, c para criar paciente mínimo, s para pular ou q para sair.");
          continue;
        }

        if (answer === "q" || answer === "quit" || answer === "exit") {
          await writeJsonFile(MANUAL_DECISIONS_PATH, decisions);
          console.log(
            JSON.stringify(
              {
                reviewedCount,
                savedTo: MANUAL_DECISIONS_PATH,
              },
              null,
              2,
            ),
          );
          return;
        }

        if (answer === "s" || answer === "skip") {
          saveDecision(decisions, task, {
            action: "skip",
            updatedAt: new Date().toISOString(),
          });
          await writeJsonFile(MANUAL_DECISIONS_PATH, decisions);
          reviewedCount += 1;
          break;
        }

        if (answer === "c" || answer === "create" || answer === "d" || answer === "draft") {
          const decision = await createManualSyntheticPatient(decisions, rl, task);
          if (!decision) {
            continue;
          }

          saveDecision(decisions, task, decision);
          await writeJsonFile(MANUAL_DECISIONS_PATH, decisions);
          reviewedCount += 1;
          break;
        }

        const candidateIndex = Number(answer) - 1;
        if (
          Number.isInteger(candidateIndex) &&
          candidateIndex >= 0 &&
          candidateIndex < task.item.candidates.length
        ) {
          const candidate = task.item.candidates[candidateIndex];
          saveDecision(decisions, task, {
            action: "match_existing",
            patientBirthDate: candidate.patientBirthDate,
            patientId: candidate.patientId,
            patientName: candidate.patientName,
            updatedAt: new Date().toISOString(),
          });
          await maybeCaptureNameExpansion(
            decisions,
            rl,
            candidate.patientId,
            candidate.patientName,
            extractedNameForTask(task),
          );
          await writeJsonFile(MANUAL_DECISIONS_PATH, decisions);
          reviewedCount += 1;
          break;
        }

        console.log("Entrada inválida.");
      }
    }
  } finally {
    rl.close();
  }

  console.log(
    JSON.stringify(
      {
        reviewedCount,
        savedTo: MANUAL_DECISIONS_PATH,
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
