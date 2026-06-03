import type { FieldCategory } from "../shared/types";
import { normalizeText } from "./text";

const RULES: Array<[FieldCategory, RegExp]> = [
  ["first_name", /\b(first name|given name|forename)\b/],
  ["last_name", /\b(last name|family name|surname)\b/],
  ["full_name", /\b(full name|your name|name)\b/],
  ["email", /\b(e-?mail)\b/],
  ["phone", /\b(phone|mobile|telephone)\b/],
  ["country", /\b(country|nation)\b/],
  ["state", /\b(state|province|region)\b/],
  ["city", /\b(city|town)\b/],
  ["linkedin", /\blinkedin\b/],
  ["github", /\bgithub\b/],
  ["portfolio", /\b(portfolio|work samples?)\b/],
  ["website", /\b(personal website|website|web site)\b/],
  ["resume", /\b(resume|cv|curriculum vitae)\b/],
  ["cover_letter", /\b(cover letter)\b/],
  ["additional_file", /\b(additional file|attachment|supporting document)\b/],
  ["why_company", /\b(why.*(company|us|join)|interest.*company)\b/],
  ["why_role", /\b(why.*(role|position|job)|interest.*(role|position))\b/],
  ["about_me", /\b(tell us about yourself|about you|professional summary|introduce yourself)\b/],
  ["hard_problem", /\b(hard|difficult|complex|challenging).*(problem|project|situation)\b/],
  ["leadership", /\b(leadership|led a team|manage a team|mentored)\b/],
  ["conflict", /\b(conflict|disagreement|difficult colleague)\b/],
  ["salary", /\b(salary|compensation|pay expectation|desired pay)\b/],
  ["relocation", /\b(relocat|willing to move)\b/],
  ["legal_authorization", /\b(legally authorized|legal authorization)\b/],
  ["work_authorization", /\b(work authorization|authorized to work|right to work)\b/],
  ["visa_sponsorship", /\b(visa|sponsorship|sponsor)\b/],
  ["start_date", /\b(start date|available to start|notice period|availability)\b/],
  ["gender", /\b(gender|sex)\b/],
  ["race_ethnicity", /\b(race|ethnicity|ethnic)\b/],
  ["disability", /\b(disability|disabled)\b/],
  ["veteran_status", /\b(veteran|military service)\b/],
  ["age", /\b(age|date of birth|birth date)\b/]
];

export function classifyField(label: string, fieldType: string): FieldCategory {
  const normalized = normalizeText(label);
  for (const [category, pattern] of RULES) {
    if (pattern.test(normalized)) return category;
  }
  if (fieldType === "file") return "additional_file";
  if (fieldType === "textarea" || normalized.endsWith("?")) return "custom_question";
  return "manual_review";
}
