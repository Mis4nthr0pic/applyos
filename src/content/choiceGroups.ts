import type { DetectedField, InsertResult } from "../shared/types";
import { classifyField } from "./fieldClassifier";
import { isElementVisible } from "./pageContext";
import { normalizeText, uniqueStrings } from "./text";

export function extractButtonChoiceGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  extractAshbyYesNoGroups(platform, seen, result);
  extractAriaRadioGroups(platform, seen, result);
}

function extractAshbyYesNoGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  document.querySelectorAll<HTMLElement>(".ashby-application-form-field-entry").forEach((entry) => {
    const yesNoContainer = entry.querySelector<HTMLElement>('[class*="_yesno_"]');
    if (!yesNoContainer) return;

    const label =
      entry.querySelector<HTMLElement>(".ashby-application-form-question-title")?.textContent?.trim() ||
      entry.querySelector<HTMLElement>("label")?.textContent?.trim();
    if (!label) return;

    const fieldPath = entry.getAttribute("data-field-path") || label;
    const fieldId = entry.dataset.applyosFieldId || `applyos-yesno-${hashString(fieldPath)}`;
    tagChoiceGroup(entry, yesNoContainer, fieldId, "yesno-button");

    const duplicateKey = `yesno-button:${fieldPath}`;
    if (seen.has(duplicateKey)) return;
    seen.add(duplicateKey);

    const buttons = Array.from(yesNoContainer.querySelectorAll("button"));
    const options = uniqueStrings(buttons.map((button) => button.textContent?.trim() || "").filter(Boolean));
    if (options.length < 2) return;

    result.push(
      buildChoiceField({
        fieldId,
        platform,
        label,
        options,
        required:
          Boolean(entry.querySelector('[class*="_required_"]')) ||
          entry.querySelector("[aria-required='true']") !== null,
        value: readYesNoButtonGroupValue(entry),
        selectorHint: `[data-field-path="${CSS.escape(fieldPath)}"]`,
        container: entry
      })
    );
  });
}

function extractAriaRadioGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  document.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach((group) => {
    if (group.querySelector('input[type="radio"][data-applyos-field-id]')) return;

    const options = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    if (options.length < 2) return;

    const label = extractAriaGroupLabel(group);
    if (!label) return;

    const fieldId = group.dataset.applyosFieldId || `applyos-aria-rg-${hashString(label)}`;
    tagChoiceGroup(group, group, fieldId, "aria-radiogroup");
    options.forEach((option) => {
      option.dataset.applyosFieldId = fieldId;
    });

    const duplicateKey = `aria-rg:${fieldId}`;
    if (seen.has(duplicateKey)) return;
    seen.add(duplicateKey);

    result.push(
      buildChoiceField({
        fieldId,
        platform,
        label,
        options: options.map((option) => getChoiceOptionText(option)).filter(Boolean),
        required: group.getAttribute("aria-required") === "true",
        value: readAriaRadioGroupValue(group),
        selectorHint: `[data-applyos-field-id="${fieldId}"]`,
        container: group
      })
    );
  });
}

function buildChoiceField(args: {
  fieldId: string;
  platform: string;
  label: string;
  options: string[];
  required: boolean;
  value: string;
  selectorHint: string;
  container: HTMLElement;
}): DetectedField {
  return {
    fieldId: args.fieldId,
    platform: args.platform,
    label: args.label,
    normalizedLabel: normalizeText(args.label),
    fieldType: "radio",
    options: args.options,
    required: args.required,
    value: args.value,
    isVisible: isElementVisible(args.container),
    isDisabled: args.container.getAttribute("aria-disabled") === "true",
    selectorHint: args.selectorHint,
    category: classifyField(args.label, "radio")
  };
}

function tagChoiceGroup(
  entry: HTMLElement,
  container: HTMLElement,
  fieldId: string,
  kind: "yesno-button" | "aria-radiogroup"
): void {
  entry.dataset.applyosFieldId = fieldId;
  entry.dataset.applyosChoiceGroup = kind;
  container.dataset.applyosFieldId = fieldId;
  container.dataset.applyosChoiceGroup = kind;
}

export function resolveChoiceGroupRoot(element: HTMLElement): HTMLElement | null {
  const direct = element.closest<HTMLElement>("[data-applyos-choice-group]");
  if (direct) return direct;
  if (element.dataset.applyosChoiceGroup) return element;
  return null;
}

export function isChoiceGroupElement(element: HTMLElement): boolean {
  return Boolean(resolveChoiceGroupRoot(element));
}

export function readYesNoButtonGroupValue(entry: HTMLElement): string {
  const container = entry.querySelector<HTMLElement>('[class*="_yesno_"]') || entry;
  const buttons = Array.from(container.querySelectorAll<HTMLElement>("button"));
  const active = buttons.find(isChoiceButtonSelected);
  if (active?.textContent?.trim()) return active.textContent.trim();

  const checkbox = entry.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox && buttons.some((button) => /^yes$/i.test(button.textContent?.trim() || ""))) {
    return checkbox.checked ? "Yes" : "No";
  }
  return "";
}

export function readAriaRadioGroupValue(group: HTMLElement): string {
  const checked = group.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
  if (checked) return getChoiceOptionText(checked);
  return "";
}

export function readChoiceGroupValue(element: HTMLElement): string {
  const root = resolveChoiceGroupRoot(element);
  if (!root) return "";

  if (root.dataset.applyosChoiceGroup === "yesno-button") {
    const entry = (root.closest(".ashby-application-form-field-entry") as HTMLElement | null) || root;
    return readYesNoButtonGroupValue(entry);
  }
  if (root.dataset.applyosChoiceGroup === "aria-radiogroup") {
    return readAriaRadioGroupValue(root);
  }
  return "";
}

export function insertChoiceGroupValue(element: HTMLElement, value: string): InsertResult | null {
  const root = resolveChoiceGroupRoot(element);
  if (!root) return null;

  if (root.dataset.applyosChoiceGroup === "yesno-button") {
    const entry = (root.closest(".ashby-application-form-field-entry") as HTMLElement | null) || root;
    const container = entry.querySelector<HTMLElement>('[class*="_yesno_"]') || entry;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    const target = buttons.find((button) => optionMatches(button.textContent || "", value));
    if (!target) return { ok: false, error: `No confident Yes/No button match for "${value}".` };
    target.click();
    return { ok: true };
  }

  if (root.dataset.applyosChoiceGroup === "aria-radiogroup") {
    const options = Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]'));
    const target = options.find((option) => optionMatches(getChoiceOptionText(option), value));
    if (!target) return { ok: false, error: `No confident option match for "${value}".` };
    target.click();
    return { ok: true };
  }

  return null;
}

export function elementBelongsToChoiceField(element: HTMLElement, field: DetectedField): boolean {
  if (element.dataset.applyosFieldId === field.fieldId) return true;
  const root = resolveChoiceGroupRoot(element);
  return root?.dataset.applyosFieldId === field.fieldId;
}

export function isChoiceCaptureTarget(element: HTMLElement): boolean {
  if (element.getAttribute("role") === "radio") return true;
  if (element instanceof HTMLButtonElement && isChoiceGroupElement(element)) return true;
  return false;
}

function extractAriaGroupLabel(group: HTMLElement): string {
  const labelledBy = group.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .join(" ")
      .trim();
    if (label) return label.slice(0, 500);
  }
  const ariaLabel = group.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 500);

  const fieldset = group.closest("fieldset");
  const legend = fieldset?.querySelector("legend")?.textContent?.trim();
  if (legend) return legend.slice(0, 500);

  const entry = group.closest(".ashby-application-form-field-entry, [class*='question'], [class*='field']");
  const title = entry
    ?.querySelector<HTMLElement>(".ashby-application-form-question-title, legend, label, h1, h2, h3, h4, p")
    ?.textContent?.trim();
  return title?.slice(0, 500) || "";
}

function getChoiceOptionText(element: HTMLElement): string {
  return (
    element.getAttribute("aria-label")?.trim() ||
    element.textContent?.replace(/\s+/g, " ").trim() ||
    element.getAttribute("data-value") ||
    ""
  );
}

function isChoiceButtonSelected(button: HTMLElement): boolean {
  if (/\b_active_/i.test(button.className)) return true;
  if (/\b(selected|active|checked|is-selected|is-active)\b/i.test(button.className)) return true;
  if (button.getAttribute("aria-pressed") === "true") return true;
  if (button.getAttribute("aria-checked") === "true") return true;
  if (button.getAttribute("aria-selected") === "true") return true;
  if (button.getAttribute("data-state") === "checked") return true;
  return false;
}

function optionMatches(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return Boolean(a && b && a === b);
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
