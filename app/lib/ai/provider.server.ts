import { ChatAnthropic } from "@langchain/anthropic";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export type ChatModel = ChatAnthropic;

export function getDefaultChatModel(options?: { maxTokens?: number }): ChatModel | null {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || "anthropic";
  const token = process.env.LLM_TOKEN?.trim();
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;

  if (!token) {
    return null;
  }

  if (provider !== "anthropic") {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }

  return new ChatAnthropic({
    apiKey: token,
    model,
    temperature: 0,
    ...(options?.maxTokens ? { maxTokens: options.maxTokens } : {}),
  });
}

