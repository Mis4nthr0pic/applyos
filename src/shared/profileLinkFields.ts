import { SAFE_PROFILE_CATEGORIES } from "./constants";
import type { DetectedField, FieldCategory } from "./types";
import { looksLikeApplicationQuestion } from "./screeningFields";

/** Platforms commonly asked for as profile URLs, handles, or usernames — not open-ended questions. */
export const PROFILE_LINK_PLATFORM_PATTERN =
  /\b(linkedin|github|gitlab|bitbucket|discord|telegram|whatsapp|youtube|twitter|x\/twitter|instagram|facebook|threads|tiktok|snapchat|twitch|reddit|stackoverflow|stack overflow|medium|substack|behance|dribbble|signal|wechat|mastodon|bluesky|bsky|portfolio|personal website|website url|web site|blog url|social media|social profile)\b/i;

const PROFILE_INTENT_PATTERN =
  /\b(profile(\s*(url|link))?|url|link|username|user name|handle|account|channel|\.com\/)\b/i;

const EXPLICIT_PROFILE_LABEL_PATTERN =
  /\b(linkedin profile|linkedin url|github profile|github\/gitlab|gitlab profile|portfolio url|personal website|website url|discord tag|discord username|telegram handle|whatsapp number|youtube channel|twitter handle|x handle|instagram handle|social media link)\b/i;

export const PROFILE_LINK_CATEGORIES: FieldCategory[] = [...SAFE_PROFILE_CATEGORIES, "social_profile"];

/** True when the field asks for a profile URL, handle, or account — never register in Answer Bank. */
export function isProfileLinkField(
  field: Pick<DetectedField, "label" | "fieldType" | "category">
): boolean {
  const label = field.label.trim();
  if (!label) return false;

  if (field.category && PROFILE_LINK_CATEGORIES.includes(field.category)) return true;
  if (EXPLICIT_PROFILE_LABEL_PATTERN.test(label)) return true;

  if (!PROFILE_LINK_PLATFORM_PATTERN.test(label)) return false;

  if (looksLikeApplicationQuestion(label) && label.includes("?")) {
    if (!/\b(profile|url|link|username|handle|account|channel)\b/i.test(label)) return false;
  }

  if (PROFILE_INTENT_PATTERN.test(label) || field.fieldType === "url") return true;

  if (/^(discord|github|gitlab|youtube|telegram|whatsapp|linkedin|twitter|instagram|tiktok|twitch|portfolio|website)$/i.test(label)) {
    return true;
  }

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
