import type { CvSource, JobInfo } from "../shared/types";
import { findCatalogEntry, inferCatalogFileName } from "../shared/cvCatalog";

export interface CvRecommendationAlternative {
  fileName: string;
  cvId: string;
  score: number;
  reason: string;
}

export interface CvRecommendation {
  recommendedFileName: string;
  recommendedCvId: string;
  confidence: number;
  reason: string;
  alternatives: CvRecommendationAlternative[];
  method: "local" | "openrouter";
}

function jobCorpus(job: JobInfo): string {
  return [
    job.title,
    job.company,
    job.department,
    job.location,
    job.description,
    ...job.requirements,
    ...job.responsibilities,
    ...job.niceToHave
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreCvAgainstJob(
  cv: CvSource,
  corpus: string,
  jobTitle?: string
): { score: number; hits: string[] } {
  const hits: string[] = [];
  let score = 0;

  for (const keyword of cv.keywords ?? []) {
    if (corpus.includes(keyword.toLowerCase())) {
      score += 12;
      hits.push(keyword);
    }
  }

  for (const role of cv.targetRoles ?? []) {
    const normalized = role.toLowerCase();
    if (corpus.includes(normalized)) {
      score += 18;
      hits.push(role);
    }
  }

  if (cv.positioningLabel && corpus.includes(cv.positioningLabel.toLowerCase())) {
    score += 25;
    hits.push(cv.positioningLabel);
  }

  const title = jobTitle?.toLowerCase() ?? "";
  if (title) {
    for (const role of cv.targetRoles ?? []) {
      const roleWords = role.toLowerCase().split(/\s+/);
      if (roleWords.every((word) => title.includes(word))) {
        score += 30;
      }
    }
  }

  return { score, hits: [...new Set(hits)] };
}

export function recommendCvLocally(job: JobInfo, cvSources: CvSource[]): CvRecommendation | undefined {
  if (!cvSources.length || (!job.title && !job.requirements.length && !job.description)) return undefined;

  const corpus = jobCorpus(job);
  const ranked = cvSources
    .map((cv) => {
      const { score, hits } = scoreCvAgainstJob(cv, corpus, job.title);
      const reason =
        hits.length > 0
          ? `Matched: ${hits.slice(0, 4).join(", ")}`
          : cv.whenToUse || cv.summary || "General fallback based on stored summary.";
      return { cv, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return undefined;

  const maxScore = Math.max(best.score, 1);
  const confidence = Math.min(0.95, Math.max(0.35, best.score / (maxScore + 40)));

  return {
    recommendedFileName: best.cv.fileName,
    recommendedCvId: best.cv.id,
    confidence,
    reason:
      best.score > 0
        ? `${best.cv.positioningLabel || best.cv.fileName}: ${best.reason}`
        : `${best.cv.positioningLabel || best.cv.fileName}. ${best.cv.whenToUse || "No strong keyword overlap; using best-fit summary."}`,
    alternatives: ranked.slice(1, 3).map((entry) => ({
      fileName: entry.cv.fileName,
      cvId: entry.cv.id,
      score: entry.score,
      reason: entry.cv.whenToUse || entry.cv.summary || entry.reason
    })),
    method: "local"
  };
}

export function enrichCvSourceFromCatalog(fileName: string): Partial<CvSource> {
  const canonical = inferCatalogFileName(fileName);
  const entry = findCatalogEntry(canonical);
  if (!entry) {
    return { fileName: canonical };
  }
  return {
    fileName: entry.fileName,
    positioningLabel: entry.positioningLabel,
    summary: entry.summary,
    targetRoles: entry.targetRoles,
    keyStrengths: entry.keyStrengths,
    whenToUse: entry.whenToUse,
    keywords: entry.keywords
  };
}

export function heuristicCvSummary(rawText: string, fileName: string): Partial<CvSource> {
  const catalog = enrichCvSourceFromCatalog(fileName);
  if (catalog.summary) return catalog;

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headline = lines[1] || lines[0] || fileName;
  const summaryBlock = lines.slice(2, 8).join(" ").slice(0, 420);

  return {
    positioningLabel: headline.slice(0, 80),
    summary: summaryBlock || `Imported CV: ${fileName}`,
    targetRoles: [],
    keyStrengths: [],
    whenToUse: "Review this CV against the job description manually.",
    keywords: headline
      .toLowerCase()
      .split(/[^a-z0-9+/#]+/)
      .filter((word) => word.length > 3)
      .slice(0, 12)
  };
}
