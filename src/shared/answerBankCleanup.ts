import { normalizeText } from "../matching/normalize";
import type { SavedAnswer } from "./types";
import {
  repairSavedAnswerText,
  shouldRemoveSavedAnswer
} from "./answerBankQuestions";

export interface AnswerBankCleanupResult {
  kept: SavedAnswer[];
  removed: SavedAnswer[];
  fixed: Array<{ before: SavedAnswer; after: SavedAnswer }>;
  summary: string;
}

function answerQualityScore(answer: SavedAnswer): number {
  let score = answer.timesUsed * 10;
  score += Math.min(answer.answer.trim().length, 400);
  if (answer.source === "generated_from_cv") score += 8;
  if (answer.source === "manual") score += 4;
  if (!answer.tags.includes("auto_saved")) score += 6;
  if (answer.originalQuestion.includes("?")) score += 3;
  return score;
}

function pickBestDuplicate(candidates: SavedAnswer[]): SavedAnswer {
  return [...candidates].sort((left, right) => answerQualityScore(right) - answerQualityScore(left))[0];
}

export function cleanupAnswerBank(answers: SavedAnswer[]): AnswerBankCleanupResult {
  const removed: SavedAnswer[] = [];
  const fixed: Array<{ before: SavedAnswer; after: SavedAnswer }> = [];
  const repaired: SavedAnswer[] = [];

  for (const answer of answers) {
    const removeReason = shouldRemoveSavedAnswer(answer.originalQuestion, answer.answer);
    if (removeReason) {
      removed.push(answer);
      continue;
    }

    const { question, title } = repairSavedAnswerText(answer.originalQuestion, answer.title);
    const normalizedQuestion = normalizeText(question);
    const changed = question !== answer.originalQuestion.trim() || title !== answer.title.trim();

    const next: SavedAnswer = {
      ...answer,
      title,
      originalQuestion: question,
      normalizedQuestion
    };

    if (shouldRemoveSavedAnswer(next.originalQuestion, next.answer)) {
      removed.push(answer);
      continue;
    }

    if (changed) fixed.push({ before: answer, after: next });
    repaired.push(next);
  }

  const grouped = new Map<string, SavedAnswer[]>();
  for (const answer of repaired) {
    const key = answer.normalizedQuestion || normalizeText(answer.originalQuestion);
    const bucket = grouped.get(key) ?? [];
    bucket.push(answer);
    grouped.set(key, bucket);
  }

  const kept: SavedAnswer[] = [];
  for (const bucket of grouped.values()) {
    if (bucket.length === 1) {
      kept.push(bucket[0]);
      continue;
    }
    const winner = pickBestDuplicate(bucket);
    kept.push(winner);
    for (const duplicate of bucket) {
      if (duplicate.id !== winner.id) removed.push(duplicate);
    }
  }

  kept.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const parts: string[] = [];
  if (removed.length) parts.push(`removed ${removed.length} broken`);
  if (fixed.length) parts.push(`fixed ${fixed.length} question${fixed.length === 1 ? "" : "s"}`);
  const summary =
    parts.length > 0
      ? `Cleaned Answer Bank: ${parts.join(", ")} · ${kept.length} remaining.`
      : `Answer Bank looks clean — ${kept.length} answer${kept.length === 1 ? "" : "s"} checked.`;

  return { kept, removed, fixed, summary };
}

export async function cleanupStoredAnswerBank(
  readAll: () => Promise<SavedAnswer[]>,
  writeAll: (answers: SavedAnswer[]) => Promise<void>
): Promise<AnswerBankCleanupResult> {
  const answers = await readAll();
  const result = cleanupAnswerBank(answers);
  if (result.removed.length || result.fixed.length) {
    await writeAll(result.kept);
  }
  return result;
}
