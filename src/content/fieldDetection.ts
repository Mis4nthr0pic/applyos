import type { DetectedField, FieldCategory, FieldType, InsertResult } from "../shared/types";
import { normalizeText, uniqueStrings } from "./text";
import { isElementVisible } from "./pageContext";
import { classifyField } from "./fieldClassifier";

const FIELD_SELECTOR =
  "textarea, input[type='text'], input[type='email'], input[type='url'], input[type='tel'], input[type='number'], input[type='checkbox'], input[type='radio'], input[type='file'], input:not([type]), select, [contenteditable='true']";

const knownFieldIds = new Set<string>();
let dependencyParents: FieldCategory[] = [];

export function extractDetectedFields(platform: string): DetectedField[] {
  const fields = Array.from(document.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
  const seen = new Set<string>();
  const result: DetectedField[] = [];

  for (const element of fields) {
    if (shouldIgnoreField(element)) continue;
    const fieldId = getOrCreateFieldId(element);
    const selectorHint = createSelectorHint(element, fieldId);
    const label = extractFieldLabel(element);
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
  if (!isElementVisible(element)) return true;
  if (element.getAttribute("aria-hidden") === "true") return true;
  if (element instanceof HTMLInputElement && ["hidden", "password", "submit", "button", "reset"].includes(element.type)) {
    return true;
  }
  const rect = element.getBoundingClientRect();
  const label = extractFieldLabel(element);
  return rect.width < 3 || rect.height < 3 || (!label && rect.left < -500);
}

function getOrCreateFieldId(element: HTMLElement): string {
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
  const stableBase =
    element instanceof HTMLInputElement && element.type === "radio" && element.name
      ? base
      : `${base}|${domIndex(element)}`;
  const fieldId = `applyos-${hashString(stableBase || `${element.tagName}-${domIndex(element)}`)}`;
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
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") return element.checked ? element.value : "";
    if (element.type === "file") return "";
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
  if (element.isContentEditable) return element.innerText;
  return "";
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
