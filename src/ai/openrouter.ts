import { throwIfAborted } from "./aiRequest";
import {
  IMPROVE_JOB_SYSTEM_PROMPT,
  PARSE_CV_SYSTEM_PROMPT,
  SMART_MATCH_SYSTEM_PROMPT,
  resolveAnswerWritingPrompt
} from "./prompts";
import { resolveOpenRouterModel } from "../shared/openRouterModels";
import type {
  ExperienceProfile,
  JobInfo,
  SavedAnswer,
  Settings
} from "../shared/types";

export interface BatchAnswerQuestion {
  fieldId: string;
  label: string;
  category?: string;
  relevantExperience: string[];
}

export interface BatchAnswerResult {
  fieldId: string;
  answer: string;
  sourceExperience?: string;
  confidence: number;
  reason: string;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function callOpenRouterJson(
  settings: Settings,
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<unknown> {
  if (settings.localOnlyMode) throw new Error("Local-only mode is enabled.");
  if (!settings.openRouterApiKey) throw new Error("Add an OpenRouter API key in Settings.");
  throwIfAborted(signal);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openRouterApiKey}`,
      "Content-Type": "application/json",
      "X-Title": "ApplyOS"
    },
    signal,
    body: JSON.stringify({
      model: resolveOpenRouterModel(settings.openRouterModel),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  // Read the body as text first: gateway/5xx errors often return an HTML page,
  // and calling response.json() on that throws a raw SyntaxError that masks the
  // real HTTP status.
  const rawBody = await response.text();
  let payload: OpenRouterResponse = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as OpenRouterResponse) : {};
  } catch {
    if (!response.ok) throw new Error(`OpenRouter request failed (${response.status}).`);
    throw new Error("OpenRouter returned invalid JSON.");
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenRouter request failed (${response.status}).`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty response.");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("OpenRouter returned invalid JSON.");
  }
}

export async function parseCvWithOpenRouter(
  cvText: string,
  settings: Settings,
  signal?: AbortSignal
): Promise<Partial<ExperienceProfile>> {
  return (await callOpenRouterJson(
    settings,
    PARSE_CV_SYSTEM_PROMPT,
    `CV:\n${cvText}\n\nReturn:\n${JSON.stringify({
      skills: [],
      companies: [],
      roles: [
        {
          title: "",
          company: "",
          duration: "",
          location: "",
          highlights: [],
          technologies: []
        }
      ],
      projects: [
        {
          name: "",
          description: "",
          technologies: [],
          url: "",
          highlights: []
        }
      ],
      education: [],
      certifications: [],
      languages: [],
      links: []
    })}`,
    signal
  )) as Partial<ExperienceProfile>;
}

export async function improveJobExtraction(
  description: string,
  settings: Settings,
  signal?: AbortSignal
): Promise<Partial<JobInfo>> {
  return (await callOpenRouterJson(
    settings,
    IMPROVE_JOB_SYSTEM_PROMPT,
    `Job description:\n${description}\n\nReturn:\n${JSON.stringify({
      title: "",
      company: "",
      location: "",
      department: "",
      employmentType: "",
      requirements: [],
      responsibilities: [],
      niceToHave: [],
      benefits: [],
      salaryRange: ""
    })}`,
    signal
  )) as Partial<JobInfo>;
}

export async function smartMatchAnswer(
  question: string,
  candidates: SavedAnswer[],
  settings: Settings,
  signal?: AbortSignal
): Promise<{
  bestMatchId: string | null;
  category: string;
  confidence: number;
  shouldUseSavedAnswer: boolean;
  reason: string;
}> {
  const candidatePayload = candidates.slice(0, 5).map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    category: candidate.category,
    originalQuestion: candidate.originalQuestion,
    answerPreview: candidate.answer.slice(0, 280)
  }));
  return (await callOpenRouterJson(
    settings,
    SMART_MATCH_SYSTEM_PROMPT,
    `New question:\n${question}\n\nSaved candidates:\n${JSON.stringify(candidatePayload)}\n\nReturn:\n${JSON.stringify({
      bestMatchId: null,
      category: "",
      confidence: 0,
      shouldUseSavedAnswer: false,
      reason: ""
    })}`,
    signal
  )) as {
    bestMatchId: string | null;
    category: string;
    confidence: number;
    shouldUseSavedAnswer: boolean;
    reason: string;
  };
}

export async function suggestAllAnswersFromExperience(
  questions: BatchAnswerQuestion[],
  profile: ExperienceProfile,
  job: JobInfo,
  settings: Settings,
  optimizedExperienceDatabase?: string,
  signal?: AbortSignal
): Promise<BatchAnswerResult[]> {
  if (!questions.length) throw new Error("No application questions to answer.");

  // Single OpenRouter request for the entire batch (de-AI-ify rules live in the system prompt).

  const useDatabase =
    settings.useOptimizedExperienceDatabase && optimizedExperienceDatabase?.trim();
  const experienceSection = useDatabase
    ? `Optimized multi-CV experience database (match the job against ALL sections, pick the best positioning angle, use verified facts only):\n${optimizedExperienceDatabase}`
    : `Experience profile:\n${JSON.stringify({
        skills: profile.skills,
        companies: profile.companies,
        roles: profile.roles,
        projects: profile.projects,
        education: profile.education,
        certifications: profile.certifications,
        languages: profile.languages
      })}`;

  const jobSearchContext = settings.jobSearchContext?.trim();
  const contextSection = jobSearchContext
    ? `Applicant job-search context (use for open-ended motivation / reason-for-change / career goal questions; combine with CV facts):\n${jobSearchContext}`
    : "";

  const payload = (await callOpenRouterJson(
    settings,
    resolveAnswerWritingPrompt(settings),
    `Answer every application question below in one batch.

${experienceSection}
${contextSection ? `\n${contextSection}\n` : ""}
Job context (match requirements and responsibilities against the full experience database above):
${JSON.stringify({
  title: job.title,
  company: job.company,
  location: job.location,
  description: job.description?.slice(0, 4000),
  requirements: job.requirements,
  responsibilities: job.responsibilities,
  niceToHave: job.niceToHave
})}

Questions (${questions.length} total):
${JSON.stringify(
  questions.map((question) => ({
    fieldId: question.fieldId,
    label: question.label,
    category: question.category,
    relevantExperience: question.relevantExperience
  }))
)}

Instructions:
1. For each question, select the best positioning angle and evidence from the entire experience database.
2. Combine facts across all CV versions when they reinforce the same point.
3. For motivation / reason-for-change / why-role questions, synthesize from Job search context (if provided) plus documented CV experience. Do not return NO_FIT when that context is available.
4. For strengths / "what you're great at" / ideal role questions, combine Job search context with CV evidence to describe positioning and target roles. Do not return NO_FIT when that context is available.
5. For "how many global markets" or similar count questions, estimate a reasonable integer from countries, regions, and markets mentioned across all CVs and experience (e.g. Portugal, Brazil, global Web3 community = multiple markets). Return only a plain number unless the field is clearly a long-text textarea.
6. Only return NO_FIT when neither the CV/database nor Job search context provides enough to draft an honest answer.
7. Apply De-AI-ify rules to every answer: form-box tone, no cover-letter voice, no banned words (seasoned, eager, leverage, aligns perfectly, etc.). Return only the final de-AI-ified text in JSON.
8. For "how many" count fields, return only a plain number (e.g. "12"), not a sentence.
9. Preserve each input fieldId exactly in your JSON response.

Return JSON with an answers array containing exactly ${questions.length} entries, one per fieldId.`,
    signal
  )) as { answers?: BatchAnswerResult[] };

  const answers = payload.answers;
  if (!Array.isArray(answers) || !answers.length) {
    throw new Error("OpenRouter returned no answers for this batch.");
  }

  const byFieldId = new Map<string, BatchAnswerResult>();
  for (const entry of answers) {
    if (entry.fieldId) byFieldId.set(entry.fieldId, entry);
  }

  const used = new Set<BatchAnswerResult>();

  return questions.map((question, index) => {
    let match = byFieldId.get(question.fieldId);
    if (match) {
      used.add(match);
      return { ...match, fieldId: question.fieldId };
    }

    if (answers[index] && !used.has(answers[index])) {
      match = answers[index];
      used.add(match);
      return { ...match, fieldId: question.fieldId };
    }

    const normalizedQuestion = normalizeQuestionLabel(question.label);
    match = answers.find(
      (entry) =>
        !used.has(entry) &&
        entry.fieldId &&
        normalizeQuestionLabel(entry.fieldId) === normalizedQuestion
    );
    if (match) {
      used.add(match);
      return { ...match, fieldId: question.fieldId };
    }

    match = answers.find(
      (entry) => !used.has(entry) && entry.reason && normalizeQuestionLabel(entry.reason).includes(normalizedQuestion.slice(0, 24))
    );
    if (match) {
      used.add(match);
      return { ...match, fieldId: question.fieldId };
    }

    const unused = answers.find((entry) => !used.has(entry));
    if (unused && answers.length === questions.length) {
      used.add(unused);
      return { ...unused, fieldId: question.fieldId };
    }

    return {
      fieldId: question.fieldId,
      answer: "NO_FIT",
      confidence: 0,
      reason: "No answer returned for this question."
    };
  });
}

function normalizeQuestionLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
