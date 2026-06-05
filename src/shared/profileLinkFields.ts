import { SAFE_PROFILE_CATEGORIES } from "./constants";
import type { DetectedField, FieldCategory } from "./types";
import { looksLikeApplicationQuestion } from "./screeningFields";

/** Social and AI platforms commonly asked for as profile URLs, handles, or accounts — not open-ended questions. */
const SOCIAL_PLATFORM_PATTERN =
  "linkedin|github|gitlab|bitbucket|discord|telegram|whatsapp|youtube|twitter|x\\/twitter|instagram|facebook|threads|tiktok|snapchat|twitch|reddit|stackoverflow|stack overflow|medium|substack|behance|dribbble|signal|wechat|mastodon|bluesky|bsky|portfolio|personal website|website url|web site|blog url|social media|social profile";

const AI_PLATFORM_PATTERN =
  "claude|anthropic|chatgpt|chat gpt|openai|open ai|deepseek|openrouter|open router|gemini|google ai|bard|copilot|github copilot|perplexity|grok|xai|mistral|llama|meta ai|hugging face|huggingface|character\\.? ai|cohere|together ai|fireworks ai|replicate|midjourney|stable diffusion|dall-?e|cursor|groq|pi ai|inflection|ollama|poe\\.com|poe ai|jan ai|lm studio|comet ml|weights & biases|wandb|replit|v0 dev|v0\\.dev|bolt\\.new|lovable|manus|genspark|phind|you\\.com|you com|kimi|moonshot|qwen|alibaba cloud|tongyi|yi large|minimax|suno|udio|runway|pika|sora|veo|elevenlabs|heygen|synthesia";

export const PROFILE_LINK_PLATFORM_PATTERN = new RegExp(
  `\\b(${SOCIAL_PLATFORM_PATTERN}|${AI_PLATFORM_PATTERN})\\b`,
  "i"
);

const PROFILE_INTENT_PATTERN =
  /\b(profile(\s*(url|link))?|url|link|username|user name|handle|account|channel|api key|api token|\.com\/)\b/i;

const EXPLICIT_PROFILE_LABEL_PATTERN =
  /\b(linkedin profile|linkedin url|github profile|github\/gitlab|gitlab profile|portfolio url|personal website|website url|discord tag|discord username|telegram handle|whatsapp number|youtube channel|twitter handle|x handle|instagram handle|social media link|chatgpt profile|chatgpt account|claude profile|claude account|openai profile|openai account|openrouter profile|openrouter account|deepseek profile|deepseek account|gemini profile|copilot profile|huggingface profile|hugging face profile)\b/i;

const SINGLE_WORD_PROFILE_LABEL =
  /^(discord|github|gitlab|youtube|telegram|whatsapp|linkedin|twitter|instagram|tiktok|twitch|portfolio|website|claude|chatgpt|gpt|openai|deepseek|openrouter|gemini|copilot|perplexity|grok|mistral|huggingface|cursor|anthropic|groq|replit|poe)$/i;

const PROFILE_LINK_FIELD_CATEGORIES: FieldCategory[] = [
  "linkedin",
  "github",
  "portfolio",
  "website",
  "social_profile"
];

/** @deprecated Use PROFILE_LINK_FIELD_CATEGORIES */
export const PROFILE_LINK_CATEGORIES = PROFILE_LINK_FIELD_CATEGORIES;

/** True when the field asks for a profile URL, handle, or account — never register in Answer Bank. */
export function isProfileLinkField(
  field: Pick<DetectedField, "label" | "fieldType" | "category">
): boolean {
  const label = field.label.trim();
  if (!label) return false;

  // Gem and similar boards sometimes use a textarea for duplicate "LinkedIn Profile" essay prompts.
  if (
    field.fieldType === "textarea" &&
    /\blinkedin\b/i.test(label) &&
    !/\b(url|link)\b/i.test(label)
  ) {
    return false;
  }

  if (field.category && PROFILE_LINK_FIELD_CATEGORIES.includes(field.category)) {
    if (field.fieldType === "textarea" && !/\b(url|link)\b/i.test(label)) return false;
    return true;
  }
  return labelRequestsProfileLink(label, field.fieldType);
}

/** True when a label asks for a social/profile URL or handle (not country/location). */
export function labelRequestsProfileLink(label: string, fieldType?: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;

  if (EXPLICIT_PROFILE_LABEL_PATTERN.test(trimmed)) return true;

  if (!PROFILE_LINK_PLATFORM_PATTERN.test(trimmed)) return false;

  if (looksLikeApplicationQuestion(trimmed) && trimmed.includes("?")) {
    if (!/\b(profile|url|link|username|handle|account|channel|api key|api token)\b/i.test(trimmed)) return false;
  }

  if (PROFILE_INTENT_PATTERN.test(trimmed) || fieldType === "url") return true;

  if (SINGLE_WORD_PROFILE_LABEL.test(trimmed)) return true;

  return false;
}

/** Label merged a profile field with a real application question (e.g. LinkedIn + reason for change). */
export function isPollutedProfileQuestionLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  if (!PROFILE_LINK_PLATFORM_PATTERN.test(normalized)) return false;
  return (
    normalized.includes("?") ||
    /\b(reason|change|visa|global markets|how many|why|what|tell us|describe|looking for)\b/.test(normalized)
  );
}
