import type { CvSource, Settings } from "../shared/types";
import { CV_SUMMARIZE_SYSTEM_PROMPT, resolvePrompt } from "./prompts";
import { callOpenRouterJson } from "./openrouter";

export async function summarizeCvWithOpenRouter(
  fileName: string,
  rawText: string,
  settings: Settings,
  signal?: AbortSignal
): Promise<Partial<CvSource>> {
  const payload = (await callOpenRouterJson(
    settings,
    resolvePrompt(settings, "cvSummarize") || CV_SUMMARIZE_SYSTEM_PROMPT,
    `File: ${fileName}\n\nCV text:\n${rawText.slice(0, 14000)}\n\nReturn JSON:\n${JSON.stringify({
      positioningLabel: "",
      summary: "",
      targetRoles: [],
      keyStrengths: [],
      whenToUse: "",
      keywords: []
    })}`,
    signal
  )) as Partial<CvSource>;

  return {
    positioningLabel: payload.positioningLabel?.trim(),
    summary: payload.summary?.trim(),
    targetRoles: payload.targetRoles ?? [],
    keyStrengths: payload.keyStrengths ?? [],
    whenToUse: payload.whenToUse?.trim(),
    keywords: (payload.keywords ?? []).map((keyword) => keyword.toLowerCase())
  };
}
