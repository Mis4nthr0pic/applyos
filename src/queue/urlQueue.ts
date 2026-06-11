import type { QueuedJobUrl, QueuePlatform } from "../shared/types";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "gh_src"
];

const CAREER_PATH_KEYWORDS = [
  "careers",
  "jobs",
  "job",
  "apply",
  "openings",
  "positions",
  "opportunities"
];

export function parseUrlsFromText(input: string, allowLocalhost = false): string[] {
  const candidates = new Set<string>();

  try {
    const parsed = JSON.parse(input) as unknown;
    collectJsonStrings(parsed).forEach((value) => candidates.add(value));
  } catch {
    // Messy pasted text is expected.
  }

  const matches = input.match(/https?:\/\/[^\s<>"'`,\]\)}]+/gi) ?? [];
  matches.forEach((value) => candidates.add(value));

  const normalized = new Map<string, string>();
  for (const candidate of candidates) {
    const cleaned = candidate.trim().replace(/[.,;:\]}]+$/, "");
    try {
      const value = normalizeJobUrl(cleaned, allowLocalhost);
      normalized.set(value, value);
    } catch {
      // Invalid and unsupported URLs are ignored.
    }
  }
  return [...normalized.values()];
}

export function normalizeJobUrl(url: string, allowLocalhost = false): string {
  const parsed = new URL(url.trim());
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  if (!allowLocalhost && isLocalHostname(parsed.hostname)) {
    throw new Error("Localhost URLs require queue dev mode.");
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";
  for (const param of TRACKING_PARAMS) parsed.searchParams.delete(param);
  if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

export function classifyJobUrl(url: string): QueuePlatform {
  const parsed = new URL(url);
  const haystack = `${parsed.hostname.toLowerCase()} ${parsed.pathname.toLowerCase()}`;
  const rules: Array<[QueuePlatform, string[]]> = [
    ["ashby", ["ashbyhq.com"]],
    ["greenhouse", ["greenhouse.io"]],
    ["lever", ["lever.co"]],
    ["workable", ["workable.com"]],
    ["workday", ["myworkdayjobs.com", "myworkdaysite.com"]],
    ["smartrecruiters", ["smartrecruiters.com"]],
    ["bamboohr", ["bamboohr.com"]],
    ["recruitee", ["recruitee.com"]],
    ["teamtailor", ["teamtailor.com"]],
    ["icims", ["icims.com"]]
  ];
  for (const [platform, needles] of rules) {
    if (needles.some((needle) => haystack.includes(needle))) return platform;
  }
  if (CAREER_PATH_KEYWORDS.some((keyword) => haystack.includes(keyword))) return "custom_careers";
  return "unknown";
}

export function createQueuedJobUrl(url: string, createdAt = new Date().toISOString()): QueuedJobUrl {
  const normalizedUrl = normalizeJobUrl(url, true);
  const parsed = new URL(normalizedUrl);
  return {
    id: crypto.randomUUID(),
    url: normalizedUrl,
    normalizedUrl,
    hostname: parsed.hostname,
    platform: classifyJobUrl(normalizedUrl),
    status: "new",
    createdAt,
    updatedAt: createdAt
  };
}

export function queueToCsv(items: QueuedJobUrl[]): string {
  const columns: Array<keyof QueuedJobUrl> = [
    "url",
    "platform",
    "status",
    "title",
    "company",
    "location",
    "fitScore",
    "fitRecommendation",
    "notes",
    "createdAt",
    "updatedAt"
  ];
  return [
    columns.join(","),
    ...items.map((item) => columns.map((column) => csvValue(item[column])).join(","))
  ].join("\n");
}

function collectJsonStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectJsonStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectJsonStrings);
  return [];
}

function isLocalHostname(hostname: string): boolean {
  const value = hostname.toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1" || value.endsWith(".localhost");
}

function csvValue(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
