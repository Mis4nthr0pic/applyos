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
  const postingText = context.jobPostingText?.trim() || "";
  const listingText = postingText.length >= 200 ? postingText : context.bodyText;
  const description =
    asString(jobPosting?.description) ||
    context.meta["og:description"] ||
    context.meta.description ||
    listingText;
  const sectionSource = postingText.length >= 200 ? postingText : description;
  const sections = extractSections(sectionSource);
  const title =
    asString(jobPosting?.title) ||
    context.meta["og:title"] ||
    context.meta.title ||
    context.title;
  const company =
    nestedString(jobPosting?.hiringOrganization, "name") ||
    context.meta["og:site_name"] ||
    inferCompanyFromTitle(context.title);
  const location =
    nestedString(jobPosting?.jobLocation, "name") ||
    nestedString(jobPosting?.jobLocation, "addressLocality") ||
    findLabelValue(listingText, "Location");

  return {
    title: cleanTitle(title),
    company,
    location,
    department: findLabelValue(listingText, "Department"),
    employmentType: asString(jobPosting?.employmentType) || findLabelValue(listingText, "Employment type"),
    description,
    requirements: sections.requirements,
    responsibilities: sections.responsibilities,
    niceToHave: sections.niceToHave,
    benefits: sections.benefits,
    salaryRange: findSalary(listingText),
    sourceUrl: context.url,
    platform,
    detectedAt: new Date().toISOString()
  };
}

function extractSections(text: string): Record<keyof typeof SECTION_LABELS, string[]> {
  const decoded = decodeHtmlEntities(text.replace(/<[^>]+>/g, "\n"));
  const split = splitIntoSections(decoded);
  const result = {
    requirements: uniqueStrings(split.requirements).slice(0, 30),
    responsibilities: uniqueStrings(split.responsibilities).slice(0, 30),
    niceToHave: uniqueStrings(split.niceToHave).slice(0, 30),
    benefits: uniqueStrings(split.benefits).slice(0, 30)
  };
  return result;
}

const SECTION_SPLITTERS: Array<{
  key: keyof typeof SECTION_LABELS;
  patterns: RegExp[];
}> = [
  {
    key: "responsibilities",
    patterns: [
      /\bin this role,? you(?:'|&#39;)ll\b/i,
      /\bwhat you(?:'|&#39;)ll do\b/i,
      /\bresponsibilities\b/i,
      /\bthe role\b/i,
      /\babout the role\b/i
    ]
  },
  {
    key: "requirements",
    patterns: [
      /\bwe(?:'|&#39;)re looking for candidates who have\b/i,
      /\bwhat we(?:'|&#39;)re looking for\b/i,
      /\brequirements\b/i,
      /\bqualifications\b/i,
      /\byou have\b/i,
      /\bwhat you(?:'|&#39;)ll need\b/i
    ]
  },
  {
    key: "niceToHave",
    patterns: [
      /\byou might also have\b/i,
      /\bnice to have\b/i,
      /\bbonus points\b/i,
      /\bpreferred qualifications\b/i,
      /\bpreferred experience\b/i
    ]
  },
  {
    key: "benefits",
    patterns: [
      /\bbenefits\b/i,
      /\bperks\b/i,
      /\bwhat we offer\b/i
    ]
  }
];

function splitIntoSections(text: string): Record<keyof typeof SECTION_LABELS, string[]> {
  const result: Record<keyof typeof SECTION_LABELS, string[]> = {
    requirements: [],
    responsibilities: [],
    niceToHave: [],
    benefits: []
  };

  type Match = { key: keyof typeof SECTION_LABELS; index: number; length: number };
  const matches: Match[] = [];
  for (const section of SECTION_SPLITTERS) {
    for (const pattern of section.patterns) {
      const match = pattern.exec(text);
      if (match?.index !== undefined) {
        matches.push({ key: section.key, index: match.index, length: match[0].length });
        break;
      }
    }
  }

  matches.sort((a, b) => a.index - b.index);
  if (!matches.length) {
    return extractSectionsByLines(text);
  }

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const nextIndex = matches[i + 1]?.index ?? text.length;
    const chunk = text.slice(current.index + current.length, nextIndex);
    result[current.key].push(...extractBulletLines(chunk));
  }

  return result;
}

function extractSectionsByLines(text: string): Record<keyof typeof SECTION_LABELS, string[]> {
  const result: Record<keyof typeof SECTION_LABELS, string[]> = {
    requirements: [],
    responsibilities: [],
    niceToHave: [],
    benefits: []
  };
  const lines = text
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
  return result;
}

function extractBulletLines(chunk: string): string[] {
  return chunk
    .split(/\n/)
    .map((line) => line.replace(/^[\s•*\-–—]+/, "").trim())
    .filter((line) => line.length > 2 && line.length < 400);
}

function decodeHtmlEntities(value: string): string {
  const textarea = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (textarea) {
    textarea.innerHTML = value;
    return textarea.value;
  }
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
