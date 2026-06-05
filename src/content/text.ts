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

/** Match profile country names to options like "Brazil (+55)" or "United States (+1)". */
export function optionMatchesCountry(left: string, right: string): boolean {
  if (optionMatches(left, right)) return true;
  const country = normalizeText(right);
  const option = normalizeText(left);
  if (!country || !option) return false;
  // Require a word boundary after the country name so "oman" doesn't match
  // "Omani Rial" and "guinea" only matches when followed by a separator.
  if (option === country || option.startsWith(`${country} `)) return true;
  const dial = left.match(/\(\+?(\d{1,4})\)/)?.[1];
  const rightDial = right.match(/\(\+?(\d{1,4})\)/)?.[1];
  if (dial && rightDial && dial === rightDial) return true;
  return false;
}

/** Prefer options that contain the user's city / location tokens. */
export function optionMatchesLocation(left: string, right: string): boolean {
  if (optionMatches(left, right)) return true;
  const target = normalizeText(right);
  const option = normalizeText(left);
  if (!target || !option) return false;

  const tokens = target.split(/\s+/).filter((token) => token.length >= 4);
  if (!tokens.length) return option.includes(target);
  const hits = tokens.filter((token) => option.includes(token)).length;
  return hits >= Math.min(2, tokens.length) || (tokens.length === 1 && hits === 1);
}
