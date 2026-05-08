import { AiSummaryCard } from "~/components/soap-plugins/AiSummaryCard";
import { CalcMcpCard } from "~/components/soap-plugins/CalcMcpCard";

import type { SoapPlugin } from "./types";

export const soapPlugins: SoapPlugin[] = [
  {
    id: "ai-summary",
    label: "AI Summary",
    Card: AiSummaryCard,
  },
  {
    id: "calc-mcp",
    label: "Calculadoras (MCP)",
    Card: CalcMcpCard,
  },
];
