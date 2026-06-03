export const CAREER_KEYWORDS = [
  "careers",
  "jobs",
  "job",
  "apply",
  "job opening",
  "position",
  "department",
  "location",
  "remote",
  "employment type",
  "submit application",
  "join talent network",
  "openings",
  "opportunities"
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
