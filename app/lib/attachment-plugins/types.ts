import type { ComponentType } from "react";

export const ATTACHMENT_PLUGIN_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export type AttachmentPluginStatus = (typeof ATTACHMENT_PLUGIN_STATUSES)[number];

export type AttachmentPluginExecutionSummary = {
  error: string | null;
  externalJobId: string | null;
  pluginId: string;
  status: AttachmentPluginStatus;
  summary: string | null;
};

export type AvailableAttachmentPlugin = {
  configured: boolean;
  id: string;
  label: string;
  supportedContentTypes: string[];
};

export type AttachmentPluginActionProps = {
  attachment: {
    contentType: string;
    id: number;
  };
  execution: AttachmentPluginExecutionSummary | null;
  onExecutionChange: (execution: AttachmentPluginExecutionSummary) => void;
  patientId: number;
  plugin: AvailableAttachmentPlugin;
};

export type AttachmentPlugin = {
  Action: ComponentType<AttachmentPluginActionProps>;
  id: string;
};
