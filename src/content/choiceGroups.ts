import type { DetectedField, InsertResult } from "../shared/types";
import { classifyField } from "./fieldClassifier";
import {
  buildContainerSelector,
  extractQuestionLabel,
  findButtonRow,
  findFieldContainer,
  findNativeRadioGroupScope,
  getStableFieldKey,
  hashString
} from "./formSemantics";
import {
  insertLinkedInSelectableValue,
  readLinkedInSelectableValue
} from "./linkedinForm";
import { isElementVisible } from "./pageContext";
import { normalizeText, optionMatches, uniqueStrings } from "./text";

const NAV_BUTTON_PATTERN = /^(submit|cancel|back|next|save|apply|continue|close|skip)$/i;

export function extractButtonChoiceGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[],
  scopeRoot: ParentNode = document
): void {
  extractAshbyYesNoGroups(platform, seen, result, scopeRoot);
  extractGenericButtonChoiceGroups(platform, seen, result, scopeRoot);
  extractAriaRadioGroups(platform, seen, result, scopeRoot);
}

function extractAshbyYesNoGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[],
  scopeRoot: ParentNode = document
): void {
  scopeRoot.querySelectorAll<HTMLElement>(".ashby-application-form-field-entry").forEach((entry) => {
    const yesNoContainer = entry.querySelector<HTMLElement>('[class*="_yesno_"]');
    if (!yesNoContainer) return;

    const label =
      entry.querySelector<HTMLElement>(".ashby-application-form-question-title")?.textContent?.trim() ||
      entry.querySelector<HTMLElement>("label")?.textContent?.trim();
    if (!label) return;

    const fieldPath = entry.getAttribute("data-field-path") || label;
    const fieldId = `applyos-yesno-${hashString(fieldPath)}`;
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
        value: readButtonGroupValue(entry),
        selectorHint: buildContainerSelector(entry, label),
        container: entry
      })
    );
  });
}

function extractGenericButtonChoiceGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[],
  scopeRoot: ParentNode = document
): void {
  const containers = new Set<HTMLElement>();

  scopeRoot.querySelectorAll<HTMLElement>("button").forEach((button) => {
    if (!isElementVisible(button)) return;
    const container = findFieldContainer(button);
    if (!container || container.dataset.applyosChoiceGroup) return;
    if (container.closest(".ashby-application-form-field-entry")?.querySelector('[class*="_yesno_"]')) return;
    const row = findButtonRow(container);
    if (!row) return;
    containers.add(container);
  });

  containers.forEach((container) => {
    const row = findButtonRow(container);
    if (!row) return;

    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>("button")).filter((button) =>
      isElementVisible(button)
    );
    if (buttons.length < 2 || buttons.length > 8) return;

    const options = uniqueStrings(buttons.map((button) => button.textContent?.trim() || "").filter(Boolean));
    if (options.length < 2) return;
    if (options.every((option) => NAV_BUTTON_PATTERN.test(option))) return;

    const label = extractQuestionLabel(container);
    if (!label || label.length < 8) return;

    const fieldKey = getStableFieldKey(container, label);
    const duplicateKey = `button-choice:${fieldKey}`;
    if (seen.has(duplicateKey)) return;
    seen.add(duplicateKey);

    const fieldId = `applyos-btn-${hashString(fieldKey)}`;
    tagChoiceGroup(container, row, fieldId, "yesno-button");

    result.push(
      buildChoiceField({
        fieldId,
        platform,
        label,
        options,
        required:
          container.querySelector("[required], [aria-required='true']") !== null ||
          /\*/.test(label),
        value: readButtonGroupValue(container),
        selectorHint: buildContainerSelector(container, label),
        container
      })
    );
  });
}

function extractAriaRadioGroups(
  platform: string,
  seen: Set<string>,
  result: DetectedField[],
  scopeRoot: ParentNode = document
): void {
  scopeRoot.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach((group) => {
    if (group.querySelector('input[type="radio"][data-applyos-field-id]')) return;

    const options = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    if (options.length < 2) return;

    const label = extractAriaGroupLabel(group);
    if (!label) return;

    const fieldId = `applyos-aria-rg-${hashString(label)}`;
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
  kind: "yesno-button" | "aria-radiogroup" | "linkedin-selectable"
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

export function readButtonGroupValue(entry: HTMLElement): string {
  const row = findButtonRow(entry) || entry.querySelector<HTMLElement>('[class*="_yesno_"]') || entry;
  const buttons = Array.from(row.querySelectorAll<HTMLElement>("button"));
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
    const entry = findFieldContainer(root) ?? root;
    return readButtonGroupValue(entry);
  }
  if (root.dataset.applyosChoiceGroup === "aria-radiogroup") {
    return readAriaRadioGroupValue(root);
  }
  if (root.dataset.applyosChoiceGroup === "linkedin-selectable") {
    return readLinkedInSelectableValue(root);
  }
  return "";
}

export function insertChoiceGroupValue(element: HTMLElement, value: string): InsertResult | null {
  const root = resolveChoiceGroupRoot(element);
  if (root?.dataset.applyosChoiceGroup === "yesno-button") {
    const entry = findFieldContainer(root) ?? root;
    return insertButtonGroupValue(entry, value);
  }

  const container = findFieldContainer(element);
  if (container?.querySelector('[class*="_yesno_"]')) {
    return insertButtonGroupValue(container, value);
  }

  if (!root) return null;

  if (root.dataset.applyosChoiceGroup === "aria-radiogroup") {
    const options = Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]'));
    const target = options.find((option) => optionMatches(getChoiceOptionText(option), value));
    if (!target) return { ok: false, error: `No confident option match for "${value}".` };
    activateChoiceOption(target);
    return { ok: true };
  }

  if (root.dataset.applyosChoiceGroup === "linkedin-selectable") {
    return insertLinkedInSelectableValue(root, value);
  }

  return null;
}

function insertButtonGroupValue(entry: HTMLElement, value: string): InsertResult {
  const row = findButtonRow(entry) || entry.querySelector<HTMLElement>('[class*="_yesno_"]') || entry;
  const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>("button"));
  const target = buttons.find((button) => optionMatches(button.textContent || "", value));
  if (!target) {
    return { ok: false, error: `No confident button option match for "${value}".` };
  }
  target.click();
  return { ok: true };
}

export function elementBelongsToChoiceField(element: HTMLElement, field: DetectedField): boolean {
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
  const container = findFieldContainer(group) ?? group;
  const label = extractQuestionLabel(container, group);
  return label.slice(0, 500);
}

function getChoiceOptionText(element: HTMLElement): string {
  return (
    element.getAttribute("aria-label")?.trim() ||
    element.textContent?.replace(/\s+/g, " ").trim() ||
    element.getAttribute("data-value") ||
    ""
  );
}

function activateChoiceOption(option: HTMLElement): void {
  const input = option.querySelector<HTMLInputElement>('input[type="radio"]');
  if (input) {
    activateNativeRadio(input);
    return;
  }

  const labelledBy = option.getAttribute("aria-labelledby");
  if (labelledBy) {
    document.getElementById(labelledBy)?.click();
  }

  option.click();

  if (option.getAttribute("aria-checked") !== "true") {
    option.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    option.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
  }
}

export function insertNativeRadioGroupValue(element: HTMLElement, value: string): InsertResult | null {
  const radios = collectNativeRadios(element);
  if (!radios.length) return null;

  const target = radios.find(
    (radio) =>
      optionMatches(radio.value, value) ||
      optionMatches(radio.getAttribute("aria-label") || "", value) ||
      optionMatches(getNativeRadioLabel(radio), value)
  );
  if (!target) {
    return { ok: false, error: `No confident radio option match for "${value}".` };
  }

  activateNativeRadio(target);
  return { ok: true };
}

function collectNativeRadios(element: HTMLElement): HTMLInputElement[] {
  if (element instanceof HTMLInputElement && element.type === "radio") {
    if (element.name) {
      return Array.from(
        document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`)
      );
    }
    const scope = findNativeRadioGroupScope(element);
    if (scope) {
      return Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    }
  }

  const scope =
    element.matches("fieldset, [role='radiogroup'], [role='group']") ? element : element.closest("fieldset, [role='radiogroup'], [role='group']");
  if (!scope) return [];

  return Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
    (radio) => radio.name || findNativeRadioGroupScope(radio) === scope
  );
}

function getNativeRadioLabel(radio: HTMLInputElement): string {
  if (radio.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(radio.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }
  const parentLabel = radio.closest("label");
  if (parentLabel?.textContent?.trim()) {
    return parentLabel.textContent.replace(/\s+/g, " ").trim();
  }
  return "";
}

function activateNativeRadio(radio: HTMLInputElement): void {
  const labelFor = radio.id
    ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(radio.id)}"]`)
    : null;
  const wrappingLabel = radio.closest("label");

  radio.focus();
  radio.click();
  labelFor?.click();
  wrappingLabel?.click();

  radio.dispatchEvent(new Event("input", { bubbles: true }));
  radio.dispatchEvent(new Event("change", { bubbles: true }));
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
