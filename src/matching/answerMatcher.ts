import Fuse, { type FuseResult } from "fuse.js";
import type { DetectedField, SavedAnswer } from "../shared/types";
import { normalizeText } from "./normalize";

export interface AnswerMatch {
  answer: SavedAnswer;
  confidence: number;
}

export function findAnswerMatches(
  field: DetectedField,
  answers: SavedAnswer[],
  limit = 3
): AnswerMatch[] {
  if (!field.label.trim() || answers.length === 0) return [];

  const fuse = new Fuse(answers, {
    includeScore: true,
    threshold: 0.55,
    ignoreLocation: true,
    keys: [
      { name: "title", weight: 0.2 },
      { name: "originalQuestion", weight: 0.3 },
      { name: "normalizedQuestion", weight: 0.3 },
      { name: "category", weight: 0.08 },
      { name: "tags", weight: 0.07 },
      { name: "answer", weight: 0.05 }
    ]
  });

  return fuse
    .search(field.label, { limit })
    .map((result: FuseResult<SavedAnswer>) => ({
      answer: result.item,
      confidence: Math.max(0, Math.min(1, 1 - (result.score ?? 1)))
    }));
}

export function hasCloseAnswerMatch(
  field: DetectedField,
  answers: SavedAnswer[],
  threshold = 0.82
): boolean {
  const matches = findAnswerMatches(field, answers, 1);
  return matches.length > 0 && matches[0].confidence >= threshold;
}

export function hasExactSavedAnswer(
  answers: SavedAnswer[],
  question: string,
  answer: string
): boolean {
  const normalizedQuestion = normalizeText(question);
  const normalizedAnswer = answer.trim().toLowerCase();
  return answers.some(
    (saved) =>
      saved.normalizedQuestion === normalizedQuestion &&
      saved.answer.trim().toLowerCase() === normalizedAnswer
  );
}
