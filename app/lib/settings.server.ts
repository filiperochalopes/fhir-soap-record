import { randomUUID } from "node:crypto";

import { prisma } from "~/lib/prisma.server";
import {
  DEFAULT_UI_TIME_ZONE,
  normalizeTimeZone,
} from "~/lib/utils";

const INSTANCE_EXPORT_NAMESPACE_PROPERTY = "instance.exportNamespace";
const UI_TIME_ZONE_PROPERTY = "ui.timeZone";

function createInstanceExportNamespace() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function getOrCreateInstanceExportNamespace() {
  const existing = await prisma.generalSetting.findUnique({
    where: {
      property: INSTANCE_EXPORT_NAMESPACE_PROPERTY,
    },
  });

  if (existing?.value.trim()) {
    return existing.value.trim();
  }

  const created = await prisma.generalSetting.upsert({
    where: {
      property: INSTANCE_EXPORT_NAMESPACE_PROPERTY,
    },
    create: {
      property: INSTANCE_EXPORT_NAMESPACE_PROPERTY,
      value: createInstanceExportNamespace(),
    },
    update: existing?.value.trim()
      ? {}
      : {
          value: createInstanceExportNamespace(),
        },
  });

  return created.value.trim();
}

export async function getUiTimeZone() {
  const setting = await prisma.generalSetting.findUnique({
    where: {
      property: UI_TIME_ZONE_PROPERTY,
    },
  });

  return normalizeTimeZone(setting?.value ?? DEFAULT_UI_TIME_ZONE);
}

export async function setUiTimeZone(value: string) {
  const normalizedValue = normalizeTimeZone(value);

  const setting = await prisma.generalSetting.upsert({
    where: {
      property: UI_TIME_ZONE_PROPERTY,
    },
    create: {
      property: UI_TIME_ZONE_PROPERTY,
      value: normalizedValue,
    },
    update: {
      value: normalizedValue,
    },
  });

  return normalizeTimeZone(setting.value);
}
