import { BUILD_DATABASE_SYSTEM_PROMPT, resolvePrompt } from "./prompts";
import type { Settings } from "../shared/types";
import { callOpenRouterJson } from "./openrouter";

export async function buildOptimizedExperienceDatabase(
  cvTexts: Array<{ fileName: string; text: string }>,
  settings: Settings
): Promise<string> {
  if (!cvTexts.length) throw new Error("Upload at least one CV to build the database.");

  const payload = (await callOpenRouterJson(
    settings,
    resolvePrompt(settings, "buildDatabase") || BUILD_DATABASE_SYSTEM_PROMPT,
    `Merge these ${cvTexts.length} CV versions into one optimized markdown experience database.

${cvTexts
  .map(
    (cv, index) =>
      `--- CV ${index + 1}: ${cv.fileName} ---\n${cv.text.slice(0, 12000)}`
  )
  .join("\n\n")}

Return JSON: {"markdown":"full markdown document"}`
  )) as { markdown?: string };

  const markdown = payload.markdown?.trim();
  if (!markdown) throw new Error("OpenRouter returned an empty experience database.");
  return markdown;
}
