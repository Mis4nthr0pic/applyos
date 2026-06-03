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

export function optionMatches(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length > 12 && b.length > 12) {
    return a.includes(b) || b.includes(a);
  }
  return false;
}
