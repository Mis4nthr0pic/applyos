import type { AnswerSuggestion, DetectedField } from "./types";
import { getApplicationQuestionFields } from "./applicationFields";
import { dedupeDetectedFields } from "./dedupeFields";

function answeredQuestionLabels(
  fields: DetectedField[],
  suggestions: Record<string, AnswerSuggestion>
): Set<string> {
  const labels = new Set<string>();
  for (const field of fields) {
    const suggestion = suggestions[field.fieldId];
    if (suggestion?.answer && suggestion.answer !== "NO_FIT") {
      labels.add(field.normalizedLabel);
    }
  }
  return labels;
}

export function uniqueApplicationQuestionFields(fields: DetectedField[]): DetectedField[] {
  return dedupeDetectedFields(getApplicationQuestionFields(fields)).filter((field) =>
    Boolean(field.normalizedLabel)
  );
}

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
  const answered = answeredQuestionLabels(fields, suggestions);
  return uniqueApplicationQuestionFields(fields).filter((field) => !answered.has(field.normalizedLabel));
}

export function countAnsweredApplicationQuestions(
  fields: DetectedField[],
  suggestions: Record<string, AnswerSuggestion>
): number {
  return uniqueApplicationQuestionFields(fields).length - applicationFieldsNeedingAi(fields, suggestions).length;
}
