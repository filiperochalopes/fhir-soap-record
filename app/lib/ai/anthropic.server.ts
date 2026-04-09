import type { TextGenerationRequest, TextProvider } from "~/lib/ai/provider.server";

type AnthropicTextProviderOptions = {
  apiBaseUrl: string;
  apiKey: string;
  apiVersion: string;
  model: string;
  timeoutMs?: number;
};

export function createAnthropicTextProvider(
  options: AnthropicTextProviderOptions,
): TextProvider {
  return {
    async generateText(request: TextGenerationRequest) {
      const response = await fetch(`${options.apiBaseUrl}/v1/messages`, {
        body: JSON.stringify({
          max_tokens: request.maxTokens ?? 1400,
          messages: [
            {
              content: [{ text: request.user, type: "text" }],
              role: "user",
            },
          ],
          model: options.model,
          system: request.system,
          temperature: request.temperature ?? 0,
        }),
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": options.apiVersion,
          "x-api-key": options.apiKey,
        },
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs ?? 45000),
      });

      if (!response.ok) {
        throw new Error(`Anthropic messages error ${response.status}: ${await response.text()}`);
      }

      const payload = (await response.json()) as {
        content?: Array<{ text?: string; type?: string }>;
      };

      if (!Array.isArray(payload.content)) {
        throw new Error("Anthropic messages returned no content");
      }

      return payload.content
        .map((item) => (typeof item.text === "string" ? item.text : ""))
        .join("\n")
        .trim();
    },
    model: options.model,
    provider: "anthropic",
  };
}
