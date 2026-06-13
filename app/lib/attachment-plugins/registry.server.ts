import type { AttachmentPluginExecution } from "@prisma/client";

import { env } from "~/lib/env.server";

export type AttachmentPluginProcessorContext = {
  attachmentId: number;
  patientId: number;
  userId: number;
};

export type AttachmentPluginProcessor = {
  id: string;
  label: string;
  supportedContentTypes: string[];
  isAvailable: () => boolean;
  refresh: (
    context: AttachmentPluginProcessorContext,
  ) => Promise<AttachmentPluginExecution>;
  start: (
    context: AttachmentPluginProcessorContext,
  ) => Promise<AttachmentPluginExecution>;
};

const processors: AttachmentPluginProcessor[] = [
  {
    id: "meuexame",
    isAvailable: () => Boolean(env.MEUEXAME_API_BASE_URL),
    label: "MeuExame",
    refresh: async (context) => {
      const { refreshMeuExameExecution } = await import(
        "~/lib/plugins/meuexame/processor.server"
      );
      return refreshMeuExameExecution(context);
    },
    start: async (context) => {
      const { startMeuExameExecution } = await import(
        "~/lib/plugins/meuexame/processor.server"
      );
      return startMeuExameExecution(context);
    },
    supportedContentTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },
];

export function getAttachmentPluginProcessor(pluginId: string) {
  const processor = processors.find(
    (candidate) => candidate.id === pluginId && candidate.isAvailable(),
  );
  if (!processor) {
    throw new Error("Plugin de anexo não encontrado.");
  }
  return processor;
}

export function listAvailableAttachmentPluginProcessors() {
  return processors.filter((processor) => processor.isAvailable());
}
