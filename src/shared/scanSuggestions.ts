import type { AnswerSuggestion, DetectedField } from "./types";
import { getApplicationQuestionFields } from "./applicationFields";

/** Keep AI suggestions when field IDs change between scans but labels stay the same. */
export function mergeScanSuggestions(
  previous: Record<string, AnswerSuggestion>,
  previousFields: DetectedField[] | undefined,
  nextFields: DetectedField[]
): Record<string, AnswerSuggestion> {
  const byLabel = new Map<string, AnswerSuggestion>();
  if (previousFields) {
    for (const field of previousFields) {
      const suggestion = previous[field.fieldId];
      if (suggestion?.answer && suggestion.answer !== "NO_FIT") {
        byLabel.set(field.normalizedLabel, suggestion);
      }
    }
  }

  const merged: Record<string, AnswerSuggestion> = {};
  for (const field of nextFields) {
    const direct = previous[field.fieldId];
    if (direct?.answer && direct.answer !== "NO_FIT") {
      merged[field.fieldId] = { ...direct, questionFieldId: field.fieldId };
      continue;
    }
    const fromLabel = byLabel.get(field.normalizedLabel);
    if (fromLabel) {
      merged[field.fieldId] = { ...fromLabel, questionFieldId: field.fieldId };
    }
  }
  return merged;
}

export function applicationFieldsNeedingAi(
  fields: DetectedField[],
  suggestions: Record<string, AnswerSuggestion>
): DetectedField[] {
  return getApplicationQuestionFields(fields).filter((field) => {
    const suggestion = suggestions[field.fieldId];
    return !suggestion?.answer || suggestion.answer === "NO_FIT";
  });
}

export function countAnsweredApplicationQuestions(
  fields: DetectedField[],
  suggestions: Record<string, AnswerSuggestion>
): number {
  return getApplicationQuestionFields(fields).length - applicationFieldsNeedingAi(fields, suggestions).length;
}
