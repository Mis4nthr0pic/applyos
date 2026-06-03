import { findBestScreeningAnswer, findAnswerMatches } from "../matching/answerMatcher";
import { isUnsafeShortAnswer } from "../shared/answerQuality";
import { isApplicationQuestionField } from "../shared/applicationFields";
import { SCREENING_QUESTION_CATEGORIES, DOCUMENT_CATEGORIES, SAFE_PROFILE_CATEGORIES } from "../shared/constants";
import { withEffectiveCategory } from "../shared/screeningFields";
import type { AnswerSuggestion, DetectedField, SavedAnswer, UserProfile } from "../shared/types";
import { insertIntoField, profileValueForField, sendToActiveTab } from "./lib";

export interface AutoInsertResult {
  inserted: number;
  skipped: number;
  failures: Array<{ label: string; error: string }>;
}

const SKIP_CATEGORIES = new Set<string>([...DOCUMENT_CATEGORIES, "manual_review"]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function sortFieldsForInsert(fields: DetectedField[]): DetectedField[] {
  function depth(field: DetectedField): number {
    if (!field.dependsOn?.length) return 0;
    return (
      1 +
      Math.max(
        ...field.dependsOn.map((category) => {
          const parent = fields.find((candidate) => candidate.category === category);
          return parent ? depth(parent) : 0;
        })
      )
    );
  }

  return [...fields].sort((left, right) => depth(left) - depth(right));
}

function shouldAutoInsertField(field: DetectedField): boolean {
  if (field.isDisabled || !field.isVisible) return false;
  if (field.fieldType === "file") return false;
  if (field.category && SKIP_CATEGORIES.has(field.category)) return false;
  return true;
}

function normalizeOption(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatAnswerForField(field: DetectedField, value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "NO_FIT") return trimmed;

  if (field.fieldType === "number" || /\bhow many\b/i.test(field.label)) {
    const match = trimmed.match(/\b(\d{1,3})\b/);
    if (match) return match[1];
  }

  return trimmed;
}

function valueMatchesFieldOptions(field: DetectedField, value: string): boolean {
  if (!field.options?.length) return true;
  if (field.fieldType !== "radio" && field.fieldType !== "select") return true;
  const normalized = normalizeOption(value);
  return field.options.some((option) => {
    const candidate = normalizeOption(option);
    if (candidate === normalized) return true;
    if (normalized.length > 12 && candidate.length > 12) {
      return candidate.includes(normalized) || normalized.includes(candidate);
    }
    return false;
  });
}

async function fieldIsEmpty(field: DetectedField): Promise<boolean> {
  const result = await sendToActiveTab<{ ok: boolean; value?: string }>({
    type: "GET_FIELD_VALUE",
    fieldId: field.fieldId,
    selectorHint: field.selectorHint
  });
  return !result.value?.trim();
}

function resolveInsertValue(
  field: DetectedField,
  userProfile: UserProfile | undefined,
  savedAnswers: SavedAnswer[],
  suggestions: Record<string, AnswerSuggestion> | undefined,
  answerBankMinConfidence: number
): { value: string; savedAnswerId?: string } | undefined {
  const resolvedField = withEffectiveCategory(field);
  const suggestion = suggestions?.[field.fieldId];
  if (suggestion?.answer && suggestion.answer !== "NO_FIT") {
    return { value: formatAnswerForField(field, suggestion.answer) };
  }

  const profileValue = profileValueForField(resolvedField, userProfile);
  if (profileValue && !isUnsafeShortAnswer(resolvedField, profileValue)) {
    return { value: profileValue };
  }

  if (isApplicationQuestionField(resolvedField)) {
    const exact = savedAnswers.find(
      (answer) => answer.normalizedQuestion === resolvedField.normalizedLabel
    );
    if (exact && !isUnsafeShortAnswer(resolvedField, exact.answer)) {
      return { value: exact.answer, savedAnswerId: exact.id };
    }
    return undefined;
  }

  const isScreeningField =
    Boolean(resolvedField.category && SCREENING_QUESTION_CATEGORIES.includes(resolvedField.category)) ||
    resolvedField.fieldType === "radio" ||
    resolvedField.fieldType === "select";

  if (isScreeningField) {
    const screeningMatch = findBestScreeningAnswer(resolvedField, savedAnswers, 0.72);
    if (screeningMatch && !isUnsafeShortAnswer(resolvedField, screeningMatch.answer.answer)) {
      return {
        value: screeningMatch.answer.answer,
        savedAnswerId: screeningMatch.answer.id
      };
    }
  }

  if (resolvedField.category && SAFE_PROFILE_CATEGORIES.includes(resolvedField.category)) {
    return undefined;
  }

  const matches = findAnswerMatches(resolvedField, savedAnswers, 1);
  const best = matches[0];
  if (
    best &&
    best.confidence >= answerBankMinConfidence &&
    !isUnsafeShortAnswer(resolvedField, best.answer.answer)
  ) {
    return { value: best.answer.answer, savedAnswerId: best.answer.id };
  }

  return undefined;
}

export async function autoInsertFields(
  fields: DetectedField[],
  options: {
    userProfile?: UserProfile;
    savedAnswers: SavedAnswer[];
    suggestions?: Record<string, AnswerSuggestion>;
    answerBankMinConfidence?: number;
    skipIfFilled?: boolean;
    onSavedAnswerUsed?: (savedAnswerId: string) => Promise<void>;
  }
): Promise<AutoInsertResult> {
  const minConfidence = options.answerBankMinConfidence ?? 0.82;
  const result: AutoInsertResult = { inserted: 0, skipped: 0, failures: [] };

  for (const field of sortFieldsForInsert(fields)) {
    if (!shouldAutoInsertField(field)) {
      result.skipped += 1;
      continue;
    }

    if (options.skipIfFilled !== false) {
      try {
        if (!(await fieldIsEmpty(field))) {
          result.skipped += 1;
          continue;
        }
      } catch {
        result.skipped += 1;
        continue;
      }
    }

    const resolved = resolveInsertValue(
      field,
      options.userProfile,
      options.savedAnswers,
      options.suggestions,
      minConfidence
    );
    if (!resolved?.value.trim() || isUnsafeShortAnswer(field, resolved.value)) {
      result.skipped += 1;
      continue;
    }
    if (!valueMatchesFieldOptions(field, resolved.value)) {
      result.skipped += 1;
      continue;
    }

    try {
      const insertResult = await insertIntoField(field, resolved.value);
      if (!insertResult.ok) {
        result.failures.push({ label: field.label, error: insertResult.error || "Insertion failed." });
        continue;
      }
      result.inserted += 1;
      if (resolved.savedAnswerId && options.onSavedAnswerUsed) {
        await options.onSavedAnswerUsed(resolved.savedAnswerId);
      }
      if (field.category === "country" || field.category === "state") {
        await delay(350);
      }
    } catch (error) {
      result.failures.push({
        label: field.label,
        error: error instanceof Error ? error.message : "Insertion failed."
      });
    }
  }

  return result;
}

export function autoInsertSummary(result: AutoInsertResult): string | undefined {
  if (!result.inserted && !result.failures.length) return undefined;
  const parts: string[] = [];
  if (result.inserted) {
    parts.push(`Auto-inserted ${result.inserted} field${result.inserted === 1 ? "" : "s"}`);
  }
  if (result.failures.length) {
    parts.push(`${result.failures.length} could not be filled`);
  }
  return parts.join(" · ");
}

export async function findUnfilledSuggestedFields(
  fields: DetectedField[],
  suggestions: Record<string, AnswerSuggestion>
): Promise<DetectedField[]> {
  const unfilled: DetectedField[] = [];

  for (const field of fields) {
    const suggestion = suggestions[field.fieldId];
    if (!suggestion?.answer || suggestion.answer === "NO_FIT") continue;

    try {
      if (await fieldIsEmpty(field)) unfilled.push(field);
    } catch {
      unfilled.push(field);
    }
  }

  return unfilled;
}
