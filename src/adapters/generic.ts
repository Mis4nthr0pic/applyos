import type { SiteAdapter } from "./types";
import type { JobInfo, PageContext } from "../shared/types";
import { classifyPage, findJobPosting } from "./classifier";
import { extractDetectedFields } from "../content/fieldDetection";
import { uniqueStrings } from "../content/text";

const SECTION_LABELS = {
  requirements: [
    "requirements",
    "qualifications",
    "you have",
    "we're looking for",
    "what we're looking for",
    "what you'll need"
  ],
  responsibilities: ["responsibilities", "what you'll do", "what you will do", "the role", "about the role"],
  niceToHave: ["nice to have", "bonus points", "preferred qualifications", "preferred experience"],
  benefits: ["benefits", "perks", "what we offer"]
};

export const genericAdapter: SiteAdapter = {
  id: "generic",
  name: "Generic page",
  priority: 0,
  matches: () => true,
  classify: classifyPage,
  async extractJobInfo(context) {
    return extractGenericJobInfo(context, "generic");
  },
  async extractFields() {
    return extractDetectedFields("generic");
  }
};

export function extractGenericJobInfo(context: PageContext, platform: string): JobInfo {
  const jobPosting = findJobPosting(context.jsonLd);
  const description =
    asString(jobPosting?.description) ||
    context.meta["og:description"] ||
    context.meta.description ||
    context.bodyText;
  const sections = extractSections(description);
  const title =
    asString(jobPosting?.title) ||
    context.meta["og:title"] ||
    document.querySelector("h1")?.textContent?.trim() ||
    context.title;
  const company =
    nestedString(jobPosting?.hiringOrganization, "name") ||
    context.meta["og:site_name"] ||
    inferCompanyFromTitle(context.title);
  const location =
    nestedString(jobPosting?.jobLocation, "name") ||
    nestedString(jobPosting?.jobLocation, "addressLocality") ||
    findLabelValue(context.bodyText, "Location");

  return {
    title: cleanTitle(title),
    company,
    location,
    department: findLabelValue(context.bodyText, "Department"),
    employmentType: asString(jobPosting?.employmentType) || findLabelValue(context.bodyText, "Employment type"),
    description,
    requirements: sections.requirements,
    responsibilities: sections.responsibilities,
    niceToHave: sections.niceToHave,
    benefits: sections.benefits,
    salaryRange: findSalary(context.bodyText),
    sourceUrl: context.url,
    platform,
    detectedAt: new Date().toISOString()
  };
}

function extractSections(text: string): Record<keyof typeof SECTION_LABELS, string[]> {
  const result = {
    requirements: [] as string[],
    responsibilities: [] as string[],
    niceToHave: [] as string[],
    benefits: [] as string[]
  };
  const lines = text
    .replace(/<[^>]+>/g, "\n")
    .split(/\n/)
    .map((line) => line.replace(/^[\s•*\-–—]+/, "").trim())
    .filter(Boolean);
  let current: keyof typeof SECTION_LABELS | undefined;
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:.]+$/, "").trim();
    const match = (Object.entries(SECTION_LABELS) as Array<
      [keyof typeof SECTION_LABELS, string[]]
    >).find(([, labels]) => labels.some((label) => normalized === label || normalized.startsWith(`${label}:`)));
    if (match) {
      current = match[0];
      continue;
    }
    if (current && line.length < 300) result[current].push(line);
  }
  for (const key of Object.keys(result) as Array<keyof typeof result>) {
    result[key] = uniqueStrings(result[key]).slice(0, 30);
  }
  return result;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(", ") || undefined;
  return undefined;
}

function nestedString(value: unknown, key: string): string | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => nestedString(item, key)).filter(Boolean).join(", ") || undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return asString(record[key]) || nestedString(record.address, key);
}

function inferCompanyFromTitle(title: string): string | undefined {
  const parts = title.split(/\s[-|–]\s/).map((part) => part.trim());
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

function cleanTitle(title?: string): string | undefined {
  if (!title) return undefined;
  return title.split(/\s[-|–]\s/)[0].trim();
}

function findLabelValue(text: string, label: string): string | undefined {
  const match = text.match(new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]{2,100})`, "i"));
  return match?.[1]?.trim();
}

function findSalary(text: string): string | undefined {
  return text.match(/(?:[$€£]\s?[\d,.]+(?:\s?[-–]\s?[$€£]?\s?[\d,.]+)?(?:\s?(?:per|\/)\s?(?:year|month|hour))?)/i)?.[0];
}
