import Fuse, { type FuseResult } from "fuse.js";
import { isUnsafeShortAnswer } from "../shared/answerQuality";
import { isProfileLinkField } from "../shared/profileLinkFields";
import type { DetectedField, FieldCategory, SavedAnswer } from "../shared/types";
import { normalizeText } from "./normalize";

export interface AnswerMatch {
  answer: SavedAnswer;
  confidence: number;
}

const TAG_MATCH_CATEGORIES = new Set<FieldCategory>([
  "gender",
  "pronouns",
  "race_ethnicity",
  "transgender",
  "disability",
  "veteran_status",
  "age",
  "work_authorization",
  "legal_authorization",
  "visa_sponsorship",
  "timezone",
  "location_eligibility",
  "previous_employment",
  "voluntary_disclosure"
]);

const SCREENING_LABEL_PATTERNS: Partial<Record<FieldCategory, RegExp>> = {
  gender: /\b(gender identity|gender|sex)\b/i,
  pronouns: /\b(preferred pronouns?|pronouns?|what are your pronouns)\b/i,
  race_ethnicity: /\b(race|ethnicity|ethnic|voluntary identification)\b/i,
  transgender: /\b(transgender|identify as transgender)\b/i,
  disability: /\b(disability|disabled)\b/i,
  veteran_status: /\b(veteran|military service)\b/i,
  age: /\b(age|date of birth|birth date)\b/i,
  work_authorization: /\b(work authorization|authorized to work|right to work)\b/i,
  legal_authorization: /\b(legally authorized|legal authorization)\b/i,
  visa_sponsorship: /\b(require sponsorship|need sponsorship|visa sponsorship|sponsor your visa|will you require sponsorship)\b/i,
  timezone: /\b(time zone|timezone)\b/i,
  location_eligibility: /\b(reside in|currently reside|eligible for hire)\b/i,
  previous_employment: /\b(previously employed|former employee|previously worked)\b/i,
  voluntary_disclosure: /\b(voluntary|self identification|self-identification)\b/i
};

export function findAnswerMatches(
  field: DetectedField,
  answers: SavedAnswer[],
  limit = 3
): AnswerMatch[] {
  if (!field.label.trim() || answers.length === 0) return [];
  if (isProfileLinkField(field)) return [];

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
    .search(field.label, { limit: limit + 5 })
    .map((result: FuseResult<SavedAnswer>) => ({
      answer: result.item,
      confidence: Math.max(0, Math.min(1, 1 - (result.score ?? 1)))
    }))
    .filter((match) => !isUnsafeShortAnswer(field, match.answer.answer))
    .slice(0, limit);
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

function questionMatchesCategory(question: string, category: FieldCategory): boolean {
  const pattern = SCREENING_LABEL_PATTERNS[category];
  if (!pattern) return false;
  return pattern.test(question);
}

function pickPreferredAnswer(candidates: SavedAnswer[]): SavedAnswer {
  return [...candidates].sort((left, right) => {
    if (right.timesUsed !== left.timesUsed) return right.timesUsed - left.timesUsed;
    return right.updatedAt.localeCompare(left.updatedAt);
  })[0];
}

/** Best saved answer for screening / EEO fields — exact question, category, then fuzzy label. */
export function findBestScreeningAnswer(
  field: DetectedField,
  answers: SavedAnswer[],
  minConfidence = 0.55
): AnswerMatch | undefined {
  if (!answers.length) return undefined;
  if (isProfileLinkField(field)) return undefined;

  const exact = answers.find((answer) => answer.normalizedQuestion === field.normalizedLabel);
  if (exact && !isUnsafeShortAnswer(field, exact.answer)) {
    return { answer: exact, confidence: 1 };
  }

  if (field.category && TAG_MATCH_CATEGORIES.has(field.category)) {
    const byCategory = answers.filter(
      (answer) =>
        !isUnsafeShortAnswer(field, answer.answer) &&
        (answer.tags.includes(field.category!) ||
          questionMatchesCategory(answer.originalQuestion, field.category!) ||
          questionMatchesCategory(answer.title, field.category!))
    );
    if (byCategory.length) {
      return { answer: pickPreferredAnswer(byCategory), confidence: 0.92 };
    }
  }

  const fuzzy = findAnswerMatches(field, answers, 1)[0];
  if (fuzzy && fuzzy.confidence >= minConfidence) {
    return fuzzy;
  }

  if (field.category === "screening_question") {
    const labelTokens = normalizeText(field.label).split(/\s+/).filter((token) => token.length > 3);
    const tokenMatches = answers.filter((answer) => {
      if (isUnsafeShortAnswer(field, answer.answer)) return false;
      const corpus = normalizeText(`${answer.title} ${answer.originalQuestion}`);
      return labelTokens.filter((token) => corpus.includes(token)).length >= Math.min(2, labelTokens.length);
    });
    if (tokenMatches.length) {
      return { answer: pickPreferredAnswer(tokenMatches), confidence: 0.75 };
    }
  }

  return undefined;
}
