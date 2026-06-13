import { AiSummaryCard } from "~/components/soap-plugins/AiSummaryCard";
import { CalcMcpCard } from "~/components/soap-plugins/CalcMcpCard";

import { SoapPlugin } from "./types";

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
