import { labelRequestsProfileLink } from "./profileLinkFields";
import { looksLikeApplicationQuestion } from "./screeningFields";

const PROFILE_FIELD_LABEL =
  /^(first name|last name|full name|email|phone|country|state|city|location|resume|cover letter|attach|website|linkedin profile|github profile|portfolio|salary expectation|start date)$/i;

const PLACEHOLDER_LABEL = /^(select\.\.\.|select|choose|type here|search|unlabeled field)$/i;

const PLACEHOLDER_ANSWER =
  /replace this sample with your own|use this entry as a template only|before inserting it into an application/i;

const COUNTRY_LIKE_ANSWER =
  /^(brazil|united states|usa|canada|mexico|germany|france|spain|portugal|india|argentina|colombia|chile)$/i;

/** Strip merged profile prefixes and keep the real application question. */
export function extractPrimaryQuestionFromLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const parts = trimmed
    .split(/\?(?=\s|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const questionPart = parts.find((part) =>
      /\b(reason|change|how many|visa|global markets|why|what|describe|tell us)\b/i.test(part)
    );
    if (questionPart) return `${questionPart}?`.replace(/\*+$/, "").trim();
  }

  const withoutProfilePrefix = trimmed
    .replace(/^(linkedin profile|github profile|github\/gitlab profile url|portfolio url|website)\s+/i, "")
    .trim();
  return withoutProfilePrefix || trimmed;
}

export function sanitizeSavedQuestion(label: string): string {
  const primary = extractPrimaryQuestionFromLabel(label);
  return primary
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\?$/g, "?")
    .trim();
}

function looksTruncated(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length < 100) return false;
  if (trimmed.endsWith("?")) return false;
  return /\b(and|or|the|a|to|wh|wha|what|how|why|use|impact)$/i.test(trimmed);
}

function answerLooksLikeCountryForProfileQuestion(question: string, answer: string): boolean {
  if (!/\b(linkedin|github|gitlab|portfolio|website|url|profile)\b/i.test(question)) return false;
  return COUNTRY_LIKE_ANSWER.test(answer.trim());
}

export function shouldRemoveSavedAnswer(question: string, answer: string): string | undefined {
  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) return "empty";
  if (a === "NO_FIT") return "no_fit";
  if (PLACEHOLDER_ANSWER.test(a)) return "placeholder_answer";

  if (labelRequestsProfileLink(q) && !looksLikeApplicationQuestion(q)) return "profile_link_field";
  if (PROFILE_FIELD_LABEL.test(q)) return "profile_field";
  if (PLACEHOLDER_LABEL.test(q)) return "placeholder_label";
  if (answerLooksLikeCountryForProfileQuestion(q, a)) return "wrong_profile_answer";
  if (looksTruncated(q)) return "truncated_question";

  return undefined;
}

export function repairSavedAnswerText(question: string, title: string): { question: string; title: string } {
  const questionFixed = sanitizeSavedQuestion(question);
  const titleFixed = sanitizeSavedQuestion(title || question).slice(0, 80) || questionFixed.slice(0, 80);
  return { question: questionFixed, title: titleFixed };
}
