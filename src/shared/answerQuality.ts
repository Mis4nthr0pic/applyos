import type { DetectedField } from "./types";

const LOCATION_LABEL_PATTERN = /\b(country|nationality|residence|citizenship|work location|anticipated work location)\b/i;

const SHORT_VALUE_ALLOWED_LABELS =
  /\b(country|nationality|residence|citizenship|state|province|timezone|time zone|pronouns|location|city)\b/i;

/** Reject country codes and other fragments that should not fill unrelated fields. */
export function isUnsafeShortAnswer(field: DetectedField, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const allowsShort = SHORT_VALUE_ALLOWED_LABELS.test(field.label);
  if (allowsShort) return false;

  if (trimmed.length <= 3) return true;
  if (/^[A-Z]{2,3}$/i.test(trimmed)) return true;

  if (LOCATION_LABEL_PATTERN.test(field.label)) return false;

  if (
    (field.fieldType === "textarea" || field.label.length > 40) &&
    trimmed.length <= 4
  ) {
    return true;
  }

  return false;
}

export function isLocationQuestion(label: string): boolean {
  return LOCATION_LABEL_PATTERN.test(label);
}
