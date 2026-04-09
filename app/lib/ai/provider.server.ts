import { createAnthropicTextProvider } from "~/lib/ai/anthropic.server";

export type TextGenerationRequest = {
  maxTokens?: number;
  system: string;
  temperature?: number;
  user: string;
};

export type TextProvider = {
  generateText: (request: TextGenerationRequest) => Promise<string>;
  model: string;
  provider: string;
};

export function getDefaultTextProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return createAnthropicTextProvider({
    apiBaseUrl:
      process.env.ANTHROPIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.anthropic.com",
    apiKey,
    apiVersion: process.env.ANTHROPIC_API_VERSION || "2023-06-01",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  });
}
