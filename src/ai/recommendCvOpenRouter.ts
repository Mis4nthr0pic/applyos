import type { CvSource, JobInfo, Settings } from "../shared/types";
import type { CvRecommendation } from "../matching/recommendCv";
import { recommendCvLocally } from "../matching/recommendCv";
import { resolvePrompt } from "./prompts";
import { callOpenRouterJson } from "./openrouter";

export async function recommendCvWithOpenRouter(
  job: JobInfo,
  cvSources: CvSource[],
  settings: Settings
): Promise<CvRecommendation> {
  const fallback = recommendCvLocally(job, cvSources);
  if (!cvSources.length) throw new Error("Import CVs in the Experience tab first.");

  const payload = (await callOpenRouterJson(
    settings,
    resolvePrompt(settings, "cvRecommendation"),
    `Job:\n${JSON.stringify({
      title: job.title,
      company: job.company,
      location: job.location,
      department: job.department,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      niceToHave: job.niceToHave,
      description: job.description?.slice(0, 3500)
    })}

Available CVs:
${JSON.stringify(
  cvSources.map((cv) => ({
    fileName: cv.fileName,
    positioningLabel: cv.positioningLabel,
    summary: cv.summary,
    targetRoles: cv.targetRoles,
    keyStrengths: cv.keyStrengths,
    whenToUse: cv.whenToUse
  }))
)}

Return JSON:\n${JSON.stringify({
      recommendedFileName: "",
      confidence: 0,
      reason: "",
      alternatives: [{ fileName: "", reason: "", score: 0 }]
    })}`
  )) as {
    recommendedFileName?: string;
    confidence?: number;
    reason?: string;
    alternatives?: Array<{ fileName?: string; reason?: string; score?: number }>;
  };

  const recommended =
    cvSources.find(
      (cv) => cv.fileName.toLowerCase() === (payload.recommendedFileName ?? "").toLowerCase()
    ) ??
    cvSources.find((cv) => fallback?.recommendedCvId === cv.id) ??
    cvSources[0];

  return {
    recommendedFileName: recommended.fileName,
    recommendedCvId: recommended.id,
    confidence: Math.max(0, Math.min(1, payload.confidence ?? fallback?.confidence ?? 0.5)),
    reason: payload.reason?.trim() || fallback?.reason || "Selected based on CV summaries.",
    alternatives: (payload.alternatives ?? [])
      .map((alt) => {
        const cv = cvSources.find((source) => source.fileName === alt.fileName);
        if (!cv) return undefined;
        return {
          fileName: cv.fileName,
          cvId: cv.id,
          score: alt.score ?? 0,
          reason: alt.reason || cv.whenToUse || cv.summary || ""
        };
      })
      .filter(Boolean) as CvRecommendation["alternatives"],
    method: "openrouter"
  };
}
