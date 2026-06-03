import type { FieldCategory } from "./types";

export const CAREER_KEYWORDS = [
  "careers",
  "jobs",
  "job",
  "apply",
  "job opening",
  "position",
  "department",
  "location",
  "remote",
  "employment type",
  "submit application",
  "join talent network",
  "openings",
  "opportunities"
];

export const SAFE_PROFILE_CATEGORIES: FieldCategory[] = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "country",
  "state",
  "city",
  "linkedin",
  "github",
  "portfolio",
  "website"
];

export const EXPERIENCE_QUESTION_CATEGORIES: FieldCategory[] = [
  "why_company",
  "why_role",
  "about_me",
  "hard_problem",
  "leadership",
  "conflict",
  "portfolio",
  "custom_question"
];

export const FACTUAL_CATEGORIES: FieldCategory[] = [
  "salary",
  "relocation",
  "work_authorization",
  "visa_sponsorship",
  "start_date"
];

export const DOCUMENT_CATEGORIES: FieldCategory[] = [
  "resume",
  "cover_letter",
  "additional_file"
];

export const SENSITIVE_CATEGORIES: FieldCategory[] = [
  "gender",
  "race_ethnicity",
  "disability",
  "veteran_status",
  "age",
  "legal_authorization"
];
