import { ANSWER_WRITING_SYSTEM_PROMPT } from "./answerWritingPrompt";
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
  user: string
): Promise<unknown> {
  if (settings.localOnlyMode) throw new Error("Local-only mode is enabled.");
  if (!settings.openRouterApiKey) throw new Error("Add an OpenRouter API key in Settings.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openRouterApiKey}`,
      "Content-Type": "application/json",
      "X-Title": "ApplyOS"
    },
    body: JSON.stringify({
      model: settings.openRouterModel || "openai/gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  const payload = (await response.json()) as OpenRouterResponse;
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
  settings: Settings
): Promise<Partial<ExperienceProfile>> {
  return (await callOpenRouterJson(
    settings,
    "Extract structured experience from this CV/resume. Do not add, infer, or embellish anything not explicitly stated. Only include information directly supported by the CV text. Return JSON only.",
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
    })}`
  )) as Partial<ExperienceProfile>;
}

export async function improveJobExtraction(
  description: string,
  settings: Settings
): Promise<Partial<JobInfo>> {
  return (await callOpenRouterJson(
    settings,
    "Extract structured job information from the job description. Return only JSON. Do not invent requirements. Only include what is explicitly stated.",
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
    })}`
  )) as Partial<JobInfo>;
}

export async function smartMatchAnswer(
  question: string,
  candidates: SavedAnswer[],
  settings: Settings
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
    "You are matching job application questions to saved answer-bank entries. Do not generate a new answer. Do not rewrite the answer. Only classify and select the best saved answer. Return JSON only.",
    `New question:\n${question}\n\nSaved candidates:\n${JSON.stringify(candidatePayload)}\n\nReturn:\n${JSON.stringify({
      bestMatchId: null,
      category: "",
      confidence: 0,
      shouldUseSavedAnswer: false,
      reason: ""
    })}`
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
  optimizedExperienceDatabase?: string
): Promise<BatchAnswerResult[]> {
  if (!questions.length) throw new Error("No application questions to answer.");

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

  const payload = (await callOpenRouterJson(
    settings,
    ANSWER_WRITING_SYSTEM_PROMPT,
    `Answer every application question below in one batch.

${experienceSection}

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
3. If no documented evidence exists, return NO_FIT for that question.
4. Apply the human voice rewrite process internally; return only final answer text in JSON.

Return JSON with an answers array containing exactly ${questions.length} entries, one per fieldId.`
  )) as { answers?: BatchAnswerResult[] };

  const answers = payload.answers;
  if (!Array.isArray(answers) || !answers.length) {
    throw new Error("OpenRouter returned no answers for this batch.");
  }

  const byFieldId = new Map(answers.map((entry) => [entry.fieldId, entry]));
  return questions.map((question) => {
    const match = byFieldId.get(question.fieldId);
    if (!match) {
      return {
        fieldId: question.fieldId,
        answer: "NO_FIT",
        confidence: 0,
        reason: "No answer returned for this question."
      };
    }
    return match;
  });
}
