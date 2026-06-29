import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type AiProvider = "google" | "openai" | "compatible";

function readProvider(): AiProvider {
  const value = (process.env.AI_PROVIDER ?? "google").toLowerCase();
  if (value === "google" || value === "openai" || value === "compatible") return value;
  throw new Error(`Unknown AI_PROVIDER "${value}". Use google, openai, or compatible.`);
}

function readApiKey(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing API key. Set one of: ${names.join(", ")}`);
}

export function getAiConfigurationError(): string | null {
  try {
    getChatModel();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "AI service is not configured";
  }
}

export function getChatModel(): LanguageModel {
  const provider = readProvider();
  const modelId = process.env.AI_MODEL?.trim();

  switch (provider) {
    case "google": {
      const apiKey = readApiKey(["GOOGLE_GENERATIVE_AI_API_KEY", "AI_API_KEY", "GEMINI_API_KEY"]);
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId ?? "gemini-2.0-flash");
    }
    case "openai": {
      const apiKey = readApiKey(["OPENAI_API_KEY", "AI_API_KEY"]);
      const openai = createOpenAI({ apiKey });
      return openai(modelId ?? "gpt-4o-mini");
    }
    case "compatible": {
      const apiKey = readApiKey(["AI_API_KEY", "LOVABLE_API_KEY"]);
      const baseURL = process.env.AI_BASE_URL?.trim() ?? "https://api.openai.com/v1";
      const gateway = createOpenAICompatible({
        name: "ai-gateway",
        baseURL,
        headers: baseURL.includes("lovable.dev")
          ? { "Lovable-API-Key": apiKey }
          : { Authorization: `Bearer ${apiKey}` },
      });
      return gateway(modelId ?? "gpt-4o-mini");
    }
  }
}
