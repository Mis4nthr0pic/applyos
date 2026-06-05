import { extractPrimaryQuestionFromLabel } from "./answerBankQuestions";
import { isPollutedProfileQuestionLabel, isProfileLinkField } from "./profileLinkFields";
import { EXPERIENCE_QUESTION_CATEGORIES, SAFE_PROFILE_CATEGORIES } from "./constants";
import type { DetectedField, FieldCategory } from "./types";
import { looksLikeApplicationQuestion } from "./screeningFields";

const APPLICATION_LABEL_PATTERNS: Array<[FieldCategory, RegExp]> = [
  ["about_me", /\b(tell us about yourself|about you|introduce yourself|professional summary|tell us what you|what you.re great|great at|ideal role for you|strengths)\b/i],
  [
    "why_role",
    /\b(ideal role|what role|great at|looking for a change|reason you are looking|whats reason|what s reason|why.*change|reason.*change|why.*leave|motivation|why.*role|why.*position|most important thing)\b/i
  ],
  ["why_company", /\b(why.*(company|us|join|team|organization)|interest.*company|why do you want)\b/i],
  ["hard_problem", /\b(hard|difficult|complex|challenging).*(problem|project|situation|technical)\b/i],
  [
    "custom_question",
    /\b(what visa|which visa|visa are you currently|how many|years of (?:work )?experience|years.*experience with|global markets|salary expectation|notice period|earliest start|anything else we should know|how did you hear|where are you based)\b/i
  ]
];

const CUSTOM_ANSWER_NAME_PATTERN =
  /\b(question_\d+|answers_attributes|text_value|custom_field|application_question|data-field-path)\b/i;

const PROFILE_FIELD_TYPES = new Set(["file"]);

function isPollutedProfileLabel(label: string): boolean {
  return isPollutedProfileQuestionLabel(label);
}

function isMisclassifiedProfileQuestion(field: DetectedField): boolean {
  if (
    field.fieldType === "textarea" &&
    field.category === "linkedin" &&
    !/\b(url|link)\b/i.test(field.label)
  ) {
    return true;
  }
  if (!field.category || !SAFE_PROFILE_CATEGORIES.includes(field.category)) return false;
  if (looksLikeNamedCustomAnswer(field)) return true;
  if (isPollutedProfileLabel(field.label)) return true;
  if (looksLikeApplicationQuestion(field.label) && field.label.includes("?")) return true;
  return false;
}

export function inferApplicationCategory(label: string): FieldCategory {
  for (const [category, pattern] of APPLICATION_LABEL_PATTERNS) {
    if (pattern.test(label)) return category;
  }
  return "custom_question";
}

export function looksLikeNamedCustomAnswer(field: DetectedField): boolean {
  const hint = `${field.selectorHint} ${field.label}`.toLowerCase();
  const name =
    field.selectorHint.match(/name="([^"]+)"/i)?.[1]?.toLowerCase() ||
    field.selectorHint.match(/\[name='([^']+)'\]/i)?.[1]?.toLowerCase() ||
    "";
  return CUSTOM_ANSWER_NAME_PATTERN.test(`${hint} ${name}`);
}

export function isApplicationQuestionField(field: DetectedField): boolean {
  if (field.isDynamic || field.isDisabled) return false;
  if (PROFILE_FIELD_TYPES.has(field.fieldType)) return false;
  if (isProfileLinkField(field) && !isPollutedProfileLabel(field.label)) return false;

  const customAnswer = looksLikeNamedCustomAnswer(field);
  const pollutedProfile = isMisclassifiedProfileQuestion(field);

  if (field.category && SAFE_PROFILE_CATEGORIES.includes(field.category) && !customAnswer && !pollutedProfile) {
    return false;
  }

  if (field.category && EXPERIENCE_QUESTION_CATEGORIES.includes(field.category)) return true;
  if (customAnswer) return true;
  if (pollutedProfile) return true;

  const questionLike = looksLikeApplicationQuestion(field.label);
  if (questionLike && !["radio", "select", "checkbox"].includes(field.fieldType)) {
    return true;
  }

  if (
    field.fieldType === "textarea" &&
    field.label.trim().length >= 20 &&
    (field.category === "manual_review" || field.category === "custom_question")
  ) {
    return true;
  }

  if (
    field.platform === "ashby" &&
    field.fieldType === "textarea" &&
    field.selectorHint.includes("data-field-path")
  ) {
    return true;
  }

  return false;
}

export function normalizeApplicationField(field: DetectedField): DetectedField {
  if (!isApplicationQuestionField(field)) return field;

  if (isPollutedProfileLabel(field.label) || isMisclassifiedProfileQuestion(field)) {
    return {
      ...field,
      label: extractPrimaryQuestionFromLabel(field.label),
      category: inferApplicationCategory(extractPrimaryQuestionFromLabel(field.label))
    };
  }

  if (field.category && EXPERIENCE_QUESTION_CATEGORIES.includes(field.category)) return field;
  return {
    ...field,
    category: inferApplicationCategory(field.label)
  };
}

export { extractPrimaryQuestionFromLabel } from "./answerBankQuestions";

export function getApplicationQuestionFields(fields: DetectedField[]): DetectedField[] {
  return fields.filter(isApplicationQuestionField).map(normalizeApplicationField);
}

/** True when the form has open-ended / custom questions worth an OpenRouter batch call. */
export function hasApplicationQuestionsForAi(fields: DetectedField[]): boolean {
  return getApplicationQuestionFields(fields).length > 0;
}
