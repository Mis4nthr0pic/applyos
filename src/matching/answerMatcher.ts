import Fuse, { type FuseResult } from "fuse.js";
import type { DetectedField, SavedAnswer } from "../shared/types";

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
