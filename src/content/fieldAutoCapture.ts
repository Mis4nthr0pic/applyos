import { SCREENING_QUESTION_CATEGORIES } from "../shared/constants";
import type { DetectedField } from "../shared/types";
import {
  elementBelongsToChoiceField,
  isChoiceCaptureTarget,
  resolveChoiceGroupRoot
} from "./choiceGroups";
import { extractDetectedFields, readFieldValue } from "./fieldDetection";

let platform = "generic";
let debounceTimer: number | undefined;
const lastCaptured = new Map<string, string>();

export function startFieldAutoCapture(currentPlatform: string): () => void {
  platform = currentPlatform;
  const handler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!isCaptureTarget(target)) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => captureFromElement(target), 600);
  };
  document.addEventListener("change", handler, true);
  document.addEventListener("input", handler, true);
  document.addEventListener("click", handler, true);
  return () => {
    document.removeEventListener("change", handler, true);
    document.removeEventListener("input", handler, true);
    document.removeEventListener("click", handler, true);
    window.clearTimeout(debounceTimer);
  };
}

function isCaptureTarget(element: HTMLElement): boolean {
  if (isChoiceCaptureTarget(element)) return true;
  if (element instanceof HTMLInputElement) {
    return !["hidden", "password", "submit", "button", "reset", "file"].includes(element.type);
  }
  return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element.isContentEditable;
}

function captureFromElement(element: HTMLElement): void {
  const fields = extractDetectedFields(platform);
  const field = fields.find((candidate) => elementMatchesField(element, candidate));
  if (!field?.category || !SCREENING_QUESTION_CATEGORIES.includes(field.category)) return;

  const target =
    resolveChoiceGroupRoot(element) ||
    document.querySelector<HTMLElement>(`[data-applyos-field-id="${CSS.escape(field.fieldId)}"]`) ||
    element;
  const value = readFieldValue(target);
  if (!value.trim()) return;

  const captureKey = `${field.normalizedLabel}:${value}`;
  if (lastCaptured.get(field.fieldId) === captureKey) return;
  lastCaptured.set(field.fieldId, captureKey);

  chrome.runtime
    .sendMessage({
      type: "APPLYOS_FIELD_ANSWERED",
      field,
      value
    })
    .catch(() => {
      // Side panel may be closed.
    });
}

function elementMatchesField(element: HTMLElement, field: DetectedField): boolean {
  if (elementBelongsToChoiceField(element, field)) return true;
  if (element.dataset.applyosFieldId === field.fieldId) return true;
  if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
    const groupId = document.querySelector<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(element.name)}"]`
    )?.dataset.applyosFieldId;
    return groupId === field.fieldId;
  }
  return false;
}
