import type { Settings } from "../shared/types";
import { callOpenRouterJson } from "./openrouter";

const BUILD_DATABASE_SYSTEM = `You merge multiple CV/resume versions for one person into a single optimized markdown experience database.

Rules:
1. Include ONLY facts explicitly stated in at least one source CV. Do not invent employers, dates, metrics, tools, or achievements.
2. Deduplicate overlapping bullets. Keep the strongest, most specific wording.
3. Preserve disagreements between CVs in a "CV Variant Index" section (e.g. different job titles for the same role).
4. Organize for job-application answer generation: positioning angles, merged timeline, skills matrix, deals/metrics, projects, education, job-matching guide.
5. Add a section explaining which angle to use for security, TAM, FDE/AI, backend, BD/growth, and payments roles.
6. Use markdown headings. No emojis. Straight quotes only.
7. Return JSON only: {"markdown":"..."}`;

export async function buildOptimizedExperienceDatabase(
  cvTexts: Array<{ fileName: string; text: string }>,
  settings: Settings
): Promise<string> {
  if (!cvTexts.length) throw new Error("Upload at least one CV to build the database.");

  const payload = (await callOpenRouterJson(
    settings,
    BUILD_DATABASE_SYSTEM,
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
