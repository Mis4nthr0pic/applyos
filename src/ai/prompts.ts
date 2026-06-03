import { ANSWER_WRITING_SYSTEM_PROMPT } from "./answerWritingPrompt";

export { ANSWER_WRITING_SYSTEM_PROMPT };

export const BUILD_DATABASE_SYSTEM_PROMPT = `You merge multiple CV/resume versions for one person into a single optimized markdown experience database.

Rules:
1. Include ONLY facts explicitly stated in at least one source CV. Do not invent employers, dates, metrics, tools, or achievements.
2. Deduplicate overlapping bullets. Keep the strongest, most specific wording.
3. Preserve disagreements between CVs in a "CV Variant Index" section (e.g. different job titles for the same role).
4. Organize for job-application answer generation: positioning angles, merged timeline, skills matrix, deals/metrics, projects, education, job-matching guide.
5. Add a section explaining which angle to use for security, TAM, FDE/AI, backend, BD/growth, and payments roles.
6. Use markdown headings. No emojis. Straight quotes only.
7. Return JSON only: {"markdown":"..."}`;

export const CV_SUMMARIZE_SYSTEM_PROMPT = `You summarize a single CV/resume for a job-application assistant.

Rules:
1. Use ONLY facts explicitly stated in the CV text. Do not invent employers, tools, or metrics.
2. Return JSON only with: positioningLabel, summary (2-3 sentences), targetRoles (array), keyStrengths (array), whenToUse (1-2 sentences), keywords (array of lowercase role/skill terms).
3. positioningLabel is a short headline like "Security engineer" or "Forward deployed engineer".`;

export const CV_RECOMMENDATION_SYSTEM_PROMPT = `You recommend which CV/resume version a job applicant should upload for a specific job posting.

Rules:
1. Compare the job title, requirements, and responsibilities against each CV summary provided.
2. Pick the single best CV fileName for the resume upload field.
3. Explain why in plain language. Mention 1-2 alternatives only if they are reasonable backups.
4. Do not invent CV content not present in the summaries.
5. Return JSON only: {"recommendedFileName":"...","confidence":0.0,"reason":"...","alternatives":[{"fileName":"...","reason":"...","score":0.0}]}`;

export const PARSE_CV_SYSTEM_PROMPT =
  "Extract structured experience from this CV/resume. Do not add, infer, or embellish anything not explicitly stated. Only include information directly supported by the CV text. Return JSON only.";

export const IMPROVE_JOB_SYSTEM_PROMPT =
  "Extract structured job information from the job description. Return only JSON. Do not invent requirements. Only include what is explicitly stated.";

export const SMART_MATCH_SYSTEM_PROMPT =
  "You are matching job application questions to saved answer-bank entries. Do not generate a new answer. Do not rewrite the answer. Only classify and select the best saved answer. Return JSON only.";

export type PromptKey =
  | "answerWriting"
  | "buildDatabase"
  | "cvSummarize"
  | "cvRecommendation"
  | "parseCv"
  | "improveJob"
  | "smartMatch";

export const PROMPT_CATALOG: Record<
  PromptKey,
  { label: string; description: string; default: string; editable: boolean }
> = {
  answerWriting: {
    label: "Answer writing (Generate All Answers)",
    description: "System prompt for batch application answers with humanizer rules.",
    default: ANSWER_WRITING_SYSTEM_PROMPT,
    editable: true
  },
  buildDatabase: {
    label: "Build CV database",
    description: "System prompt when merging multiple CVs into markdown.",
    default: BUILD_DATABASE_SYSTEM_PROMPT,
    editable: true
  },
  cvSummarize: {
    label: "Summarize CV",
    description: "System prompt when importing a CV to generate its library summary.",
    default: CV_SUMMARIZE_SYSTEM_PROMPT,
    editable: true
  },
  cvRecommendation: {
    label: "Recommend CV for job",
    description: "System prompt when picking which CV to upload for a role.",
    default: CV_RECOMMENDATION_SYSTEM_PROMPT,
    editable: true
  },
  parseCv: {
    label: "Parse CV to profile",
    description: "System prompt for structured Experience Profile extraction.",
    default: PARSE_CV_SYSTEM_PROMPT,
    editable: false
  },
  improveJob: {
    label: "Improve job extraction",
    description: "System prompt for re-extracting job requirements from description.",
    default: IMPROVE_JOB_SYSTEM_PROMPT,
    editable: false
  },
  smartMatch: {
    label: "Smart Match",
    description: "System prompt for matching questions to saved Answer Bank entries.",
    default: SMART_MATCH_SYSTEM_PROMPT,
    editable: false
  }
};

export function resolvePrompt(
  settings: { promptOverrides?: Partial<Record<PromptKey, string>> },
  key: PromptKey
): string {
  const override = settings.promptOverrides?.[key]?.trim();
  if (override) return override;
  return PROMPT_CATALOG[key].default;
}
