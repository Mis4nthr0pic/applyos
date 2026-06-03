export interface OpenRouterModelOption {
  id: string;
  label: string;
  hint?: string;
}

export const CUSTOM_OPENROUTER_MODEL = "__custom__";

export const OPENROUTER_MODEL_GROUPS: Array<{
  provider: string;
  models: OpenRouterModelOption[];
}> = [
  {
    provider: "Google Gemini",
    models: [
      {
        id: "google/gemini-2.0-flash-lite-001",
        label: "Gemini 2.0 Flash Lite",
        hint: "Fast and cheap. Good default for batch answers."
      },
      {
        id: "google/gemini-2.0-flash-001",
        label: "Gemini 2.0 Flash",
        hint: "Stronger than Lite, still fast."
      },
      {
        id: "google/gemini-2.5-flash-lite-preview-09-2025",
        label: "Gemini 2.5 Flash Lite (preview)",
        hint: "Newer lite tier with reasoning support."
      },
      {
        id: "google/gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        hint: "Workhorse model with built-in reasoning."
      },
      {
        id: "google/gemini-2.5-flash-preview-09-2025",
        label: "Gemini 2.5 Flash (Sep 2025 preview)",
        hint: "Latest Flash preview checkpoint."
      },
      {
        id: "google/gemini-2.5-pro-preview-05-06",
        label: "Gemini 2.5 Pro (preview)",
        hint: "Highest quality Gemini. Higher cost."
      },
      {
        id: "google/gemini-flash-1.5",
        label: "Gemini 1.5 Flash",
        hint: "Previous generation. Stable fallback."
      }
    ]
  },
  {
    provider: "OpenAI",
    models: [
      {
        id: "openai/gpt-4o-mini",
        label: "GPT-4o mini",
        hint: "Cheap OpenAI default. Good JSON output."
      },
      {
        id: "openai/gpt-4o",
        label: "GPT-4o",
        hint: "Strong general model."
      },
      {
        id: "openai/gpt-4.1-mini",
        label: "GPT-4.1 mini",
        hint: "Newer mini tier."
      },
      {
        id: "openai/gpt-4.1",
        label: "GPT-4.1",
        hint: "Newer full-size GPT."
      }
    ]
  },
  {
    provider: "Anthropic",
    models: [
      {
        id: "anthropic/claude-3.5-haiku",
        label: "Claude 3.5 Haiku",
        hint: "Fast Claude tier."
      },
      {
        id: "anthropic/claude-3.7-sonnet",
        label: "Claude 3.7 Sonnet",
        hint: "Balanced quality and speed."
      },
      {
        id: "anthropic/claude-sonnet-4",
        label: "Claude Sonnet 4",
        hint: "High quality writing and reasoning."
      }
    ]
  },
  {
    provider: "DeepSeek",
    models: [
      {
        id: "deepseek/deepseek-chat-v3-0324",
        label: "DeepSeek V3",
        hint: "Strong open-weight style model via OpenRouter."
      },
      {
        id: "deepseek/deepseek-r1",
        label: "DeepSeek R1",
        hint: "Reasoning-focused. Slower, higher quality."
      }
    ]
  },
  {
    provider: "Meta",
    models: [
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        label: "Llama 3.3 70B Instruct",
        hint: "Large open model."
      },
      {
        id: "meta-llama/llama-3.1-8b-instruct",
        label: "Llama 3.1 8B Instruct",
        hint: "Small and inexpensive."
      }
    ]
  },
  {
    provider: "Mistral",
    models: [
      {
        id: "mistralai/mistral-small-3.1-24b-instruct",
        label: "Mistral Small 3.1",
        hint: "Compact European model."
      },
      {
        id: "mistralai/mistral-large-2411",
        label: "Mistral Large",
        hint: "Higher capability Mistral tier."
      }
    ]
  }
];

export const OPENROUTER_MODELS = OPENROUTER_MODEL_GROUPS.flatMap((group) => group.models);

export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-001";

export function findOpenRouterModel(id?: string): OpenRouterModelOption | undefined {
  if (!id) return undefined;
  return OPENROUTER_MODELS.find((model) => model.id === id);
}

export function isKnownOpenRouterModel(id?: string): boolean {
  return Boolean(findOpenRouterModel(id));
}

export function resolveOpenRouterModel(id?: string): string {
  return id?.trim() || DEFAULT_OPENROUTER_MODEL;
}
