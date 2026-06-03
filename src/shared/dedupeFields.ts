import type { DetectedField } from "./types";

function fieldQualityScore(field: DetectedField): number {
  let score = 0;
  if (field.isVisible) score += 5;
  if (!field.isDisabled) score += 3;
  if (field.selectorHint.startsWith("#")) score += 4;
  if (field.selectorHint.includes("[name=")) score += 3;
  if (field.fieldType === "select" || field.fieldType === "textarea") score += 1;
  if ((field.value?.trim().length ?? 0) > 0) score += 2;
  if (field.label.length >= 8 && field.label.length <= 120) score += 2;
  if (/^select\s*\.{2,}$/i.test(field.label.trim())) score -= 6;
  return score;
}

function fieldDedupeKey(field: DetectedField): string {
  const frame = field.frameId ?? 0;
  const nameMatch = field.selectorHint.match(/\[name="([^"]+)"\]/i);
  if (nameMatch?.[1]) return `${frame}:name:${nameMatch[1]}`;

  const label =
    field.normalizedLabel.length >= 3 && field.normalizedLabel !== "unlabeled field"
      ? field.normalizedLabel
      : field.selectorHint;
  return `${frame}:label:${label}`;
}

/** Collapse duplicate detections caused by progressive render / rescan polling. */
export function dedupeDetectedFields(fields: DetectedField[]): DetectedField[] {
  const best = new Map<string, DetectedField>();

  for (const field of fields) {
    const key = fieldDedupeKey(field);
    const existing = best.get(key);
    if (!existing || fieldQualityScore(field) > fieldQualityScore(existing)) {
      best.set(key, field);
    }
  }

  return [...best.values()];
}

/** Replace fields from one frame while keeping detections from other frames. */
export function mergeFieldsFromFrame(
  existing: DetectedField[],
  incoming: DetectedField[],
  frameId = 0
): DetectedField[] {
  const tagged = incoming.map((field) => ({ ...field, frameId: field.frameId ?? frameId }));
  const keep = existing.filter((field) => (field.frameId ?? 0) !== frameId);
  return dedupeDetectedFields([...keep, ...tagged]);
}
