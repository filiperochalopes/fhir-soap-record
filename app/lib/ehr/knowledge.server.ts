import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  ENCOUNTER_ARCHETYPE_ID,
  SOAP_OPERATIONAL_TEMPLATE,
  SOAP_TEMPLATE_ID,
} from "~/lib/ehr/templates/soap";
import {
  NARRATIVE_OPERATIONAL_TEMPLATE,
  NARRATIVE_TEMPLATE_ID,
} from "~/lib/ehr/templates/narrative";

type KnowledgeClient = PrismaClient | Prisma.TransactionClient;

const ENCOUNTER_ARCHETYPE = {
  id: ENCOUNTER_ARCHETYPE_ID,
  concept: "Clinical encounter",
  rmType: "COMPOSITION",
  definition: {
    allowedEntryTypes: ["OBSERVATION", "EVALUATION"],
    category: "event",
    purpose: "Canonical clinical encounter container for soap-ehr",
  },
};

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function ensureClinicalKnowledge(db: KnowledgeClient) {
  await db.archetypeDefinition.upsert({
    where: { id: ENCOUNTER_ARCHETYPE.id },
    create: {
      concept: ENCOUNTER_ARCHETYPE.concept,
      contentHash: hashJson(ENCOUNTER_ARCHETYPE.definition),
      definition: ENCOUNTER_ARCHETYPE.definition,
      id: ENCOUNTER_ARCHETYPE.id,
      rmType: ENCOUNTER_ARCHETYPE.rmType,
    },
    update: {
      concept: ENCOUNTER_ARCHETYPE.concept,
      contentHash: hashJson(ENCOUNTER_ARCHETYPE.definition),
      definition: ENCOUNTER_ARCHETYPE.definition,
      rmType: ENCOUNTER_ARCHETYPE.rmType,
    },
  });

  const templates = [
    {
      id: SOAP_TEMPLATE_ID,
      name: SOAP_OPERATIONAL_TEMPLATE.name,
      operationalTemplate: SOAP_OPERATIONAL_TEMPLATE,
      version: SOAP_OPERATIONAL_TEMPLATE.version,
    },
    {
      id: NARRATIVE_TEMPLATE_ID,
      name: NARRATIVE_OPERATIONAL_TEMPLATE.name,
      operationalTemplate: NARRATIVE_OPERATIONAL_TEMPLATE,
      version: NARRATIVE_OPERATIONAL_TEMPLATE.version,
    },
  ];

  for (const template of templates) {
    const data = {
      active: true,
      contentHash: hashJson(template.operationalTemplate),
      name: template.name,
      operationalTemplate: template.operationalTemplate,
      rootArchetypeId: ENCOUNTER_ARCHETYPE_ID,
      version: template.version,
    } satisfies Omit<Prisma.TemplateDefinitionCreateInput, "id" | "compositionVersions">;

    await db.templateDefinition.upsert({
      where: { id: template.id },
      create: { id: template.id, ...data },
      update: data,
    });
  }
}
