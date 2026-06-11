import { AiSummaryCard } from "~/components/soap-plugins/AiSummaryCard";
import { AttachmentsCard } from "~/components/soap-plugins/AttachmentsCard";
import { CalcMcpCard } from "~/components/soap-plugins/CalcMcpCard";

import { GenericPlugin, SoapPlugin } from "./types";

export const genericPlugins: GenericPlugin[] = [
  new GenericPlugin({
    id: "attachments",
    label: "Anexos",
    Card: AttachmentsCard,
  }),
];

export const soapPlugins: SoapPlugin[] = [
  new SoapPlugin({
    id: "ai-summary",
    label: "AI Summary",
    Card: AiSummaryCard,
  }),
  new SoapPlugin({
    id: "calc-mcp",
    label: "Calculadoras (MCP)",
    Card: CalcMcpCard,
  }),
];
