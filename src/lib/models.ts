import { createOpenAI } from "@ai-sdk/openai";

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "English Voice Tutor",
  },
});

export const FREE_MODEL_ID = "openrouter/free";

/** OpenRouter selects only from the currently available zero-cost models. */
export const FREE_MODELS = [
  {
    id: FREE_MODEL_ID,
    label: "OpenRouter Free",
    hint: "Только бесплатные модели",
  },
] as const;

export type FreeModelId = (typeof FREE_MODELS)[number]["id"];

export function resolveModel(_modelId?: string) {
  // Intentionally ignore client input so a modified request cannot select a paid model.
  return openrouter.chat(FREE_MODEL_ID);
}
