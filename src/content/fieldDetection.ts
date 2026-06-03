import type { DetectedField, FieldCategory, FieldType, InsertResult } from "../shared/types";
import { normalizeText, optionMatches, uniqueStrings } from "./text";
import { isElementVisible } from "./pageContext";
import { classifyField } from "./fieldClassifier";
import {
  extractButtonChoiceGroups,
  insertChoiceGroupValue,
  insertNativeRadioGroupValue,
  readChoiceGroupValue,
  resolveChoiceGroupRoot
} from "./choiceGroups";
import { isComboboxInput, readComboboxDisplayValue } from "./combobox";
import {
  extractQuestionLabel,
  findFieldContainer,
  findNearbyHeading,
  hashString,
  isManagedChoiceInput,
  resolveFieldContainerFromHint,
  FIELD_CONTAINER_SELECTORS
} from "./formSemantics";

const FIELD_SELECTOR =
  "textarea, input[type='text'], input[type='email'], input[type='url'], input[type='tel'], input[type='number'], input[type='checkbox'], input[type='radio'], input[type='file'], input:not([type]), select, [contenteditable='true']";

const knownFieldIds = new Set<string>();
let dependencyParents: FieldCategory[] = [];

export function extractDetectedFields(platform: string): DetectedField[] {
  const fields = Array.from(document.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
  const seen = new Set<string>();
  const processedRadioGroups = new Set<string>();
  const result: DetectedField[] = [];

  for (const element of fields) {
    if (shouldIgnoreField(element)) continue;

    if (element instanceof HTMLInputElement && element.type === "radio") {
      if (!element.name || processedRadioGroups.has(element.name)) continue;
      processedRadioGroups.add(element.name);
    }

    const fieldId = getOrCreateFieldId(element);
    const selectorHint = createSelectorHint(element, fieldId);
    const label =
      element instanceof HTMLInputElement && element.type === "radio"
        ? extractRadioGroupLabel(element)
        : extractFieldLabel(element);
    const fieldType = getFieldType(element);
    const normalizedLabel = normalizeText(label);
    const category = classifyField(label, fieldType);
    const duplicateKey =
      element instanceof HTMLInputElement && element.type === "radio" && element.name
        ? `radio:${element.name}`
        : `${selectorHint}:${fieldId}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);

    const isDynamic = knownFieldIds.size > 0 && !knownFieldIds.has(fieldId);
    const dependsOn = inferDependencies(category, isDynamic);
    result.push({
      fieldId,
      platform,
      label: label || "Unlabeled field",
      normalizedLabel,
      fieldType,
      options: extractOptions(element),
      required: isRequired(element),
      value: getFieldValue(element),
      isVisible: isElementVisible(element),
      isDisabled: isDisabled(element),
      selectorHint,
      category,
      dependsOn,
      isDynamic
    });
    knownFieldIds.add(fieldId);
  }

  extractButtonChoiceGroups(platform, seen, result);
  result.forEach((field) => knownFieldIds.add(field.fieldId));
  return result;
}

export function attachDependencyListeners(): () => void {
  const handler = (event: Event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const category = classifyField(extractFieldLabel(select), "select");
    if (category === "country") dependencyParents = ["country"];
    else if (category === "state") {
      dependencyParents = uniqueStrings([...dependencyParents, "state"]) as FieldCategory[];
    } else dependencyParents = [category];
  };
  document.addEventListener("change", handler, true);
  return () => document.removeEventListener("change", handler, true);
}

function inferDependencies(category: FieldCategory, isDynamic: boolean): string[] | undefined {
  if (!isDynamic) return undefined;
  if (category === "state" && dependencyParents.includes("country")) return ["country"];
  if (category === "city") {
    const dependencies = ["country", "state"].filter((item) =>
      dependencyParents.includes(item as FieldCategory)
    );
    return dependencies.length ? dependencies : undefined;
  }
  return dependencyParents.length ? dependencyParents : undefined;
}

function shouldIgnoreField(element: HTMLElement): boolean {
  if (isManagedChoiceInput(element)) return true;

  if (element instanceof HTMLInputElement && element.type === "radio") {
    if (!isRadioFieldAccessible(element)) return true;
  } else if (!isElementVisible(element)) {
    return true;
  }
  if (element.getAttribute("aria-hidden") === "true") return true;
  if (element instanceof HTMLInputElement && ["hidden", "password", "submit", "button", "reset"].includes(element.type)) {
    return true;
  }
  const rect = element.getBoundingClientRect();
  const label = extractFieldLabel(element);
  return rect.width < 3 || rect.height < 3 || (!label && rect.left < -500);
}

function isRadioFieldAccessible(radio: HTMLInputElement): boolean {
  if (isElementVisible(radio)) return true;
  if (radio.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(radio.id)}"]`);
    if (label && isElementVisible(label)) return true;
  }
  const parentLabel = radio.closest("label");
  if (parentLabel && isElementVisible(parentLabel)) return true;
  const group = radio.closest('[role="radiogroup"], fieldset, [class*="question"], [class*="field"]');
  if (group instanceof HTMLElement && isElementVisible(group)) {
    const rect = group.getBoundingClientRect();
    return rect.width > 20 && rect.height > 20;
  }
  return false;
}

function getOrCreateFieldId(element: HTMLElement): string {
  if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
    const existing = document.querySelector<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(element.name)}"][data-applyos-field-id]`
    );
    if (existing?.dataset.applyosFieldId) return existing.dataset.applyosFieldId;
    const fieldId = `applyos-radio-${hashString(element.name)}`;
    document
      .querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`)
      .forEach((radio) => {
        radio.dataset.applyosFieldId = fieldId;
      });
    return fieldId;
  }

  const existing = element.dataset.applyosFieldId;
  if (existing) return existing;
  const base = [
    element.tagName,
    element.getAttribute("type"),
    element.id,
    element.getAttribute("name"),
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder")
  ]
    .filter(Boolean)
    .join("|");
  const fieldId = `applyos-${hashString(base || `${element.tagName}-${domIndex(element)}`)}`;
  element.dataset.applyosFieldId = fieldId;
  return fieldId;
}

function domIndex(element: Element): number {
  return Array.from(document.querySelectorAll(FIELD_SELECTOR)).indexOf(element);
}

function createSelectorHint(element: HTMLElement, fieldId: string): string {
  const container = findFieldContainer(element);
  if (container) {
    const fieldPath = container.getAttribute("data-field-path");
    if (fieldPath) return `[data-field-path="${CSS.escape(fieldPath)}"]`;
    const automationId = container.getAttribute("data-automation-id");
    if (automationId) return `[data-automation-id="${CSS.escape(automationId)}"]`;
  }
  if (element.id) return `#${CSS.escape(element.id)}`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  return `[data-applyos-field-id="${fieldId}"]`;
}

function extractRadioGroupLabel(radio: HTMLInputElement): string {
  const container = findFieldContainer(radio) ?? radio.closest("fieldset, [role='radiogroup'], [role='group']");
  if (container instanceof HTMLElement) {
    const label = extractQuestionLabel(container, radio);
    if (label.length > 8) return label;
  }

  return extractFieldLabel(radio);
}

function extractFieldLabel(element: HTMLElement): string {
  const container = findFieldContainer(element);
  if (container) {
    const label = extractQuestionLabel(container, element);
    if (label) return label;
  }

  const candidates: string[] = [];
  if (element.id) {
    const explicit = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(element.id)}"]`);
    if (explicit?.innerText) candidates.push(explicit.innerText);
  }
  const parentLabel = element.closest("label");
  if (parentLabel?.innerText) candidates.push(parentLabel.innerText);
  candidates.push(
    element.getAttribute("aria-label") || "",
    element.getAttribute("placeholder") || "",
    element.getAttribute("name") || ""
  );

  const heading = findNearbyHeading(element);
  if (heading) candidates.push(heading);
  return uniqueStrings(candidates)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function getFieldType(element: HTMLElement): FieldType {
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element instanceof HTMLSelectElement) return "select";
  if (element.isContentEditable) return "textarea";
  if (element instanceof HTMLInputElement) {
    const type = element.type || "text";
    if (["email", "url", "tel", "number", "checkbox", "radio", "file"].includes(type)) {
      return type as FieldType;
    }
    return "text";
  }
  return "unknown";
}

function extractOptions(element: HTMLElement): string[] | undefined {
  if (element instanceof HTMLSelectElement) {
    return uniqueStrings(
      Array.from(element.options)
        .map((option) => option.textContent?.trim() || option.value)
        .filter(Boolean)
    );
  }
  if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
    return uniqueStrings(
      Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`))
        .map((radio) => extractFieldLabel(radio) || radio.value)
        .filter(Boolean)
    );
  }
  return undefined;
}

function isRequired(element: HTMLElement): boolean {
  return (
    element.hasAttribute("required") ||
    element.getAttribute("aria-required") === "true" ||
    /\*/.test(extractFieldLabel(element))
  );
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-disabled") === "true" ||
    (element instanceof HTMLInputElement && element.disabled) ||
    (element instanceof HTMLTextAreaElement && element.disabled) ||
    (element instanceof HTMLSelectElement && element.disabled)
  );
}

function getFieldValue(element: HTMLElement): string {
  return readFieldValue(element);
}

export function readFieldValue(element: HTMLElement | null): string {
  if (!element) return "";

  const choiceValue = readChoiceGroupValue(element);
  if (choiceValue) return choiceValue;
  if (resolveChoiceGroupRoot(element)) return "";

  if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
    const selected = document.querySelector<HTMLInputElement>(
      `input[type="radio"][name="${CSS.escape(element.name)}"]:checked`
    );
    if (!selected) return "";
    return getRadioOptionLabel(selected) || selected.value;
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") return element.checked ? getRadioOptionLabel(element) || element.value || "Yes" : "";
    if (element.type === "file") return "";
    if (isComboboxInput(element)) {
      const display = readComboboxDisplayValue(element);
      if (display) return display;
    }
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    if (element instanceof HTMLSelectElement && element.selectedOptions[0]) {
      return element.selectedOptions[0].textContent?.trim() || element.value;
    }
    return element.value;
  }
  if (element.isContentEditable) return element.innerText;
  return "";
}

function getRadioOptionLabel(input: HTMLInputElement): string {
  if (input.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }
  const parentLabel = input.closest("label");
  if (parentLabel?.textContent?.trim()) {
    return parentLabel.textContent.replace(/\s+/g, " ").trim();
  }
  return input.getAttribute("aria-label") || "";
}

export function findField(fieldId: string, selectorHint: string): HTMLElement | null {
  let target: HTMLElement | null = null;

  if (!selectorHint.includes("data-applyos-field-id")) {
    target = resolveFieldContainerFromHint(selectorHint);
  }

  if (!target) {
    const hinted = safeQuery(selectorHint);
    target = hinted ? findFieldContainer(hinted) ?? hinted : null;
  }

  if (!target) {
    const nodes = document.querySelectorAll<HTMLElement>(`[data-applyos-field-id="${CSS.escape(fieldId)}"]`);
    for (const node of nodes) {
      try {
        if (node.matches(FIELD_CONTAINER_SELECTORS)) {
          target = node;
          break;
        }
      } catch {
        // Ignore invalid selector matches.
      }
    }
    if (!target) {
      for (const node of nodes) {
        if (node.dataset.applyosChoiceGroup) {
          target = node;
          break;
        }
      }
    }
    if (!target) {
      for (const node of nodes) {
        if (node instanceof HTMLInputElement && node.type === "radio") {
          target = node.closest<HTMLElement>("fieldset, [role='radiogroup'], [role='group']");
          if (target) break;
        }
      }
    }
    if (!target && nodes.length) target = nodes[0] ?? null;
  }

  return target ? resolveInsertTarget(target) : null;
}

function resolveInsertTarget(element: HTMLElement): HTMLElement {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable
  ) {
    return element;
  }

  const input = element.querySelector<HTMLElement>(
    'textarea, select, input:not([type="hidden"]):not([type="submit"]):not([type="button"]), [contenteditable="true"]'
  );
  if (input && isElementVisible(input)) return input;
  return element;
}

function safeQuery(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

export function insertFieldValue(
  fieldId: string,
  selectorHint: string,
  value: string
): InsertResult {
  const element = findField(fieldId, selectorHint);
  if (!element) return { ok: false, error: "The field could not be found. Rescan the page and try again." };
  if (isDisabled(element)) return { ok: false, error: "This field is disabled and needs manual review." };
  if (element instanceof HTMLInputElement && element.type === "file") {
    return { ok: false, error: "File uploads require manual user action." };
  }

  const choiceResult = insertChoiceGroupValue(element, value);
  if (choiceResult) return choiceResult;

  const nativeRadioResult = insertNativeRadioGroupValue(element, value);
  if (nativeRadioResult) return nativeRadioResult;

  if (element instanceof HTMLInputElement && element.type === "radio") {
    return { ok: false, error: `No confident radio option match for "${value}".` };
  }

  element.focus();
  if (element instanceof HTMLSelectElement) {
    const option = findSelectOption(element, value);
    if (!option) return { ok: false, error: `No confident dropdown option match for "${value}".` };
    setNativeValue(element, option.value);
  } else if (element instanceof HTMLInputElement && element.type === "checkbox") {
    const shouldCheck = /^(true|yes|1|checked)$/i.test(value);
    if (element.checked !== shouldCheck) element.click();
    return { ok: true };
  } else if (element.isContentEditable) {
    element.innerText = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setNativeValue(element, value);
  } else {
    return { ok: false, error: "This field type is not supported for insertion." };
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
  return { ok: true };
}

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): void {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
}

function findSelectOption(select: HTMLSelectElement, value: string): HTMLOptionElement | undefined {
  const options = Array.from(select.options);
  return (
    options.find((option) => option.value === value || option.textContent?.trim() === value) ||
    options.find(
      (option) =>
        option.value.toLowerCase() === value.toLowerCase() ||
        option.textContent?.trim().toLowerCase() === value.toLowerCase()
    ) ||
    options.find(
      (option) => optionMatches(option.value, value) || optionMatches(option.textContent || "", value)
    )
  );
}
