import { isAutoSavableField, withEffectiveCategory } from "../shared/screeningFields";
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
  if (element.getAttribute("role") === "option" || element.getAttribute("role") === "listbox") {
    return true;
  }
  return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element.isContentEditable;
}

function captureFromElement(element: HTMLElement): void {
  const fields = extractDetectedFields(platform);
  const field = fields.find((candidate) => elementMatchesField(element, candidate));
  if (!field || !isAutoSavableField(field)) return;

  const savableField = withEffectiveCategory(field);

  const target =
    resolveChoiceGroupRoot(element) ||
    document.querySelector<HTMLElement>(`[data-applyos-field-id="${CSS.escape(field.fieldId)}"]`) ||
    element;
  const value = readFieldValue(target);
  if (!value.trim()) return;

  const captureKey = `${savableField.normalizedLabel}:${value}`;
  if (lastCaptured.get(savableField.fieldId) === captureKey) return;
  lastCaptured.set(savableField.fieldId, captureKey);

  chrome.runtime
    .sendMessage({
      type: "APPLYOS_FIELD_ANSWERED",
      field: savableField,
      value
    })
    .catch(() => {
      // Side panel may be closed.
    });
}

function elementMatchesField(element: HTMLElement, field: DetectedField): boolean {
  if (
    field.selectorHint.includes("data-field-path") ||
    field.selectorHint.includes("data-automation-id") ||
    field.selectorHint.startsWith("#")
  ) {
    try {
      const entry = document.querySelector<HTMLElement>(field.selectorHint);
      if (entry && (entry === element || entry.contains(element))) return true;
    } catch {
      // Ignore invalid selector hints.
    }
  }

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
