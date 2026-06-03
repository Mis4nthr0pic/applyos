import type { DetectedField, FieldCategory, FieldType, InsertResult } from "../shared/types";
import { normalizeText, uniqueStrings } from "./text";
import { isElementVisible } from "./pageContext";
import { classifyField } from "./fieldClassifier";
import {
  extractButtonChoiceGroups,
  insertChoiceGroupValue,
  readChoiceGroupValue,
  resolveChoiceGroupRoot
} from "./choiceGroups";

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
        : `${selectorHint}:${normalizedLabel}`;
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

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function createSelectorHint(element: HTMLElement, fieldId: string): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  return `[data-applyos-field-id="${fieldId}"]`;
}

function extractRadioGroupLabel(radio: HTMLInputElement): string {
  const fieldset = radio.closest("fieldset");
  const legend = fieldset?.querySelector("legend")?.textContent?.trim();
  if (legend && legend.length > 8) return legend.slice(0, 500);

  const group = radio.closest(
    "[role='group'], [role='radiogroup'], .application-question, [class*='question'], [class*='field'], fieldset"
  );
  if (group) {
    const candidates = Array.from(
      group.querySelectorAll<HTMLElement>("legend, h1, h2, h3, h4, h5, h6, p, label, span, div")
    )
      .filter((node) => !node.querySelector("input, select, textarea") && isElementVisible(node))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
      .filter((text) => text.length > 12 && !/^(yes|no|select)$/i.test(text));
    if (candidates.length) {
      return candidates.sort((a, b) => b.length - a.length)[0].slice(0, 500);
    }
  }

  return extractFieldLabel(radio);
}

function extractFieldLabel(element: HTMLElement): string {
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

  const container = element.closest(
    ".field, .form-field, .form-group, .application-question, [class*='field'], [class*='question'], [data-testid]"
  );
  if (container) {
    const nearby = Array.from(
      container.querySelectorAll<HTMLElement>("label, legend, h1, h2, h3, h4, p, span")
    )
      .filter((item) => item !== element && isElementVisible(item))
      .map((item) => item.innerText?.trim() || "")
      .filter(Boolean)
      .slice(0, 4);
    candidates.push(...nearby);
  }

  const heading = findNearbyHeading(element);
  if (heading) candidates.push(heading);
  return uniqueStrings(candidates)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function findNearbyHeading(element: HTMLElement): string {
  let current: Element | null = element;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) return sibling.textContent?.trim() || "";
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return "";
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
  return (
    document.querySelector<HTMLElement>(`[data-applyos-field-id="${CSS.escape(fieldId)}"]`) ||
    safeQuery(selectorHint)
  );
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

  element.focus();
  if (element instanceof HTMLSelectElement) {
    const option = findSelectOption(element, value);
    if (!option) return { ok: false, error: `No confident dropdown option match for "${value}".` };
    setNativeValue(element, option.value);
  } else if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
    if (element.type === "radio" && element.name) {
      const radio = Array.from(
        document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(element.name)}"]`)
      ).find((candidate) => optionMatches(candidate.value, value) || optionMatches(extractFieldLabel(candidate), value));
      if (!radio) return { ok: false, error: `No confident radio option match for "${value}".` };
      radio.click();
      return { ok: true };
    }
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

function optionMatches(left: string, right: string): boolean {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return Boolean(a && b && a === b);
}
