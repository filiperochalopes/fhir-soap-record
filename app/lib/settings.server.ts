import { randomUUID } from "node:crypto";

import { prisma } from "~/lib/prisma.server";

const INSTANCE_EXPORT_NAMESPACE_PROPERTY = "instance.exportNamespace";

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
