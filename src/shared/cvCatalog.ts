import type { CvSource } from "./types";

export interface CvCatalogEntry {
  fileName: string;
  positioningLabel: string;
  summary: string;
  targetRoles: string[];
  keyStrengths: string[];
  whenToUse: string;
  keywords: string[];
}

/** Example CV angles for local matching. Replace summaries after importing your own files. */
export const CV_CATALOG: CvCatalogEntry[] = [
  {
    fileName: "cv-security.pdf",
    positioningLabel: "Security engineer",
    summary:
      "Security-focused CV emphasizing audits, vulnerability research, incident response, and secure development practices.",
    targetRoles: ["Security engineer", "AppSec", "Auditor", "Incident response"],
    keyStrengths: ["Threat modeling", "Code review", "Incident triage", "Secure SDLC"],
    whenToUse: "Roles where security depth should lead the narrative.",
    keywords: ["security", "audit", "appsec", "vulnerability", "incident", "researcher"]
  },
  {
    fileName: "cv-engineer.pdf",
    positioningLabel: "Senior software engineer",
    summary:
      "Engineering CV emphasizing backend systems, distributed architecture, reliability, and delivery at scale.",
    targetRoles: ["Software engineer", "Backend engineer", "Platform engineer", "Staff engineer"],
    keyStrengths: ["System design", "Backend scale", "Observability", "Technical leadership"],
    whenToUse: "IC or engineering-heavy roles where implementation depth matters most.",
    keywords: ["software engineer", "backend", "platform", "distributed", "staff", "senior engineer"]
  },
  {
    fileName: "cv-growth.pdf",
    positioningLabel: "BD & growth",
    summary:
      "Business development CV emphasizing partnerships, ecosystem growth, GTM, and market expansion.",
    targetRoles: ["Business development", "Growth", "Partnerships", "GTM"],
    keyStrengths: ["Partnerships", "Fundraising", "Ecosystem events", "Market entry"],
    whenToUse: "BD, partnerships, or growth roles — not pure IC engineering reqs.",
    keywords: ["business development", "bd", "growth", "partnership", "gtm", "ecosystem"]
  },
  {
    fileName: "cv-tam.pdf",
    positioningLabel: "Technical account manager",
    summary:
      "Client-facing technical CV bridging discovery, scoping, stakeholder communication, and delivery.",
    targetRoles: ["Technical account manager", "Solutions engineer", "Pre-sales engineer"],
    keyStrengths: ["Client scoping", "Technical discovery", "Stakeholder communication"],
    whenToUse: "TAM, solutions, or customer-facing technical roles.",
    keywords: ["technical account", "tam", "solutions", "pre-sales", "client", "customer success"]
  },
  {
    fileName: "cv-fde.pdf",
    positioningLabel: "Forward Deployed Engineer | Applied AI & LLM Systems",
    summary:
      "FDE CV: embeds with customer teams, scopes problems, ships applied AI in production. Zokyo LLM pipelines and client embedding; OpenSense developer platform; Avem enterprise customer implementation; 15 years backend/platform with observability and enterprise integrations.",
    targetRoles: [
      "Forward deployed engineer",
      "Applied AI engineer",
      "Solutions engineer",
      "Customer engineer",
      "ML engineer"
    ],
    keyStrengths: [
      "Customer embedding and scoping",
      "LLM pipelines and evals",
      "Production observability",
      "Technical demos and integrations",
      "Applied AI shipping"
    ],
    whenToUse:
      "Default CV for FDE, solutions engineering, applied AI, customer-facing technical, and LLM product roles. Use unless the job is explicitly security-only or DevRel/BD-only.",
    keywords: [
      "forward deployed",
      "fde",
      "applied ai",
      "llm",
      "solutions engineer",
      "customer engineer",
      "observability",
      "eval",
      "embedding",
      "integrations"
    ]
  }
];

export const CV_CATALOG_ALIASES: Record<string, string> = {
  "alex_melo_sec.pdf": "cv-security.pdf",
  "alexandre_melo_cv_26.pdf": "cv-engineer.pdf",
  "cv_alex_melo_p.pdf": "cv-growth.pdf",
  "cv_tam.pdf": "cv-tam.pdf",
  "cvca.pdf": "cv-fde.pdf"
};

export function normalizeCvFileName(fileName: string): string {
  return fileName.trim().toLowerCase();
}

export function findCatalogEntry(fileName: string): CvCatalogEntry | undefined {
  const normalized = normalizeCvFileName(fileName);
  const aliased = CV_CATALOG_ALIASES[normalized];
  if (aliased) {
    return CV_CATALOG.find((entry) => normalizeCvFileName(entry.fileName) === normalizeCvFileName(aliased));
  }
  return CV_CATALOG.find((entry) => normalizeCvFileName(entry.fileName) === normalized);
}

/** Map a catalog canonical name back to the imported filename when we know the alias. */
export function restoreImportedFileName(fileName: string): string {
  const normalized = normalizeCvFileName(fileName);
  for (const [original, canonical] of Object.entries(CV_CATALOG_ALIASES)) {
    if (normalizeCvFileName(canonical) === normalized) {
      return original;
    }
  }
  return fileName;
}

export function catalogEntryToCvFields(
  entry: CvCatalogEntry
): Pick<
  CvSource,
  "positioningLabel" | "summary" | "targetRoles" | "keyStrengths" | "whenToUse" | "keywords"
> {
  return {
    positioningLabel: entry.positioningLabel,
    summary: entry.summary,
    targetRoles: entry.targetRoles,
    keyStrengths: entry.keyStrengths,
    whenToUse: entry.whenToUse,
    keywords: entry.keywords
  };
}

export function inferCatalogFileName(fileName: string): string {
  const entry = findCatalogEntry(fileName);
  return entry?.fileName ?? fileName;
}
