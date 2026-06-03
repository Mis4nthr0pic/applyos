import { EXPERIENCE_QUESTION_CATEGORIES } from "./constants";
import type { DetectedField, FieldCategory } from "./types";
import { looksLikeApplicationQuestion } from "./screeningFields";

const APPLICATION_LABEL_PATTERNS: Array<[FieldCategory, RegExp]> = [
  [
    "why_role",
    /\b(looking for a change|reason you are looking|whats reason|what s reason|why.*change|reason.*change|why.*leave|motivation|why.*role|why.*position)\b/i
  ],
  ["why_company", /\b(why.*(company|us|join|team|organization)|interest.*company|why do you want)\b/i],
  ["about_me", /\b(tell us about yourself|about you|introduce yourself|professional summary)\b/i],
  ["hard_problem", /\b(hard|difficult|complex|challenging).*(problem|project|situation|technical)\b/i],
  [
    "custom_question",
    /\b(what visa|which visa|visa are you currently|how many|years of experience|global markets|salary expectation|notice period|earliest start|linkedin|portfolio|website|github|anything else we should know)\b/i
  ]
];

export function inferApplicationCategory(label: string): FieldCategory {
  for (const [category, pattern] of APPLICATION_LABEL_PATTERNS) {
    if (pattern.test(label)) return category;
  }
  return "custom_question";
}

export function isApplicationQuestionField(field: DetectedField): boolean {
  if (field.isDynamic || field.isDisabled) return false;
  if (field.fieldType === "file") return false;
  if (field.category && EXPERIENCE_QUESTION_CATEGORIES.includes(field.category)) return true;
  if (
    (field.fieldType === "textarea" ||
      field.fieldType === "text" ||
      field.fieldType === "unknown") &&
    looksLikeApplicationQuestion(field.label)
  ) {
    return true;
  }
  if (
    field.fieldType === "textarea" &&
    field.label.trim().length >= 20 &&
    (field.category === "manual_review" || field.category === "custom_question")
  ) {
    return true;
  }
  return false;
}

export function normalizeApplicationField(field: DetectedField): DetectedField {
  if (!isApplicationQuestionField(field)) return field;
  if (field.category && EXPERIENCE_QUESTION_CATEGORIES.includes(field.category)) return field;
  return {
    ...field,
    category: inferApplicationCategory(field.label)
  };
}

export function getApplicationQuestionFields(fields: DetectedField[]): DetectedField[] {
  return fields.filter(isApplicationQuestionField).map(normalizeApplicationField);
}
