import { isElementVisible } from "./pageContext";
import { normalizeText, uniqueStrings } from "./text";

/** Containers used across Greenhouse, Ashby, Lever, Workable, Workday, SmartRecruiters, etc. */
export const FIELD_CONTAINER_SELECTORS = [
  "fieldset",
  "[role='group']",
  "[role='radiogroup']",
  ".ashby-application-form-field-entry",
  ".application-question",
  ".application--questions",
  ".application-field",
  ".field",
  ".form-field",
  ".form-group",
  ".question",
  ".text-input-wrapper",
  "[class*='application']",
  "[class*='question']",
  "[class*='field-entry']",
  "[class*='field']",
  "[data-field-path]",
  "[data-automation-id]",
  "[data-testid*='question']",
  "[data-testid*='field']"
].join(",");

const QUESTION_LABEL_SELECTORS = [
  "legend",
  "label",
  ".application-label",
  ".application-label--required",
  ".label",
  ".question-title",
  ".field-label",
  "[class*='question-title']",
  "[class*='field-label']",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span"
].join(",");

const YES_NO_OPTION_PATTERN = /^(yes|no|true|false|y|n)$/i;

export function findFieldContainer(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(FIELD_CONTAINER_SELECTORS);
}

export function getStableFieldKey(container: HTMLElement, label: string): string {
  return (
    container.getAttribute("data-field-path") ||
    container.getAttribute("data-automation-id") ||
    container.getAttribute("data-testid") ||
    container.id ||
    label
  );
}

export function buildContainerSelector(container: HTMLElement, label: string): string {
  const fieldPath = container.getAttribute("data-field-path");
  if (fieldPath) return `[data-field-path="${CSS.escape(fieldPath)}"]`;

  const automationId = container.getAttribute("data-automation-id");
  if (automationId) return `[data-automation-id="${CSS.escape(automationId)}"]`;

  if (container.id) return `#${CSS.escape(container.id)}`;

  return `[data-applyos-field-id="${CSS.escape(`applyos-container-${hashString(label)}`)}"]`;
}

export function extractQuestionLabel(container: HTMLElement, input?: HTMLElement | null): string {
  const candidates: string[] = [];

  const labelledBy = (input ?? container).getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .join(" ")
      .trim();
    if (label) candidates.push(label);
  }

  const ariaLabel = (input ?? container).getAttribute("aria-label")?.trim();
  if (ariaLabel) candidates.push(ariaLabel);

  if (input?.id) {
    const explicit = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    if (explicit?.innerText?.trim()) candidates.push(explicit.innerText);
  }

  const parentLabel = input?.closest("label");
  if (parentLabel?.innerText?.trim()) candidates.push(parentLabel.innerText);

  Array.from(container.querySelectorAll<HTMLElement>(QUESTION_LABEL_SELECTORS))
    .filter((node) => node !== input && isElementVisible(node) && !node.querySelector("input, select, textarea, button"))
    .map((node) => node.innerText?.replace(/\s+/g, " ").trim() || "")
    .filter((text) => text.length >= 8 && !YES_NO_OPTION_PATTERN.test(text))
    .slice(0, 4)
    .forEach((text) => candidates.push(text));

  const heading = findNearbyHeading(container);
  if (heading) candidates.push(heading);

  return uniqueStrings(candidates)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function findNearbyHeading(element: HTMLElement): string {
  let current: Element | null = element;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) return sibling.textContent?.trim() || "";
      if (sibling instanceof HTMLElement && isElementVisible(sibling)) {
        const text = sibling.textContent?.replace(/\s+/g, " ").trim() || "";
        if (text.length >= 12 && text.length <= 200 && !YES_NO_OPTION_PATTERN.test(text)) {
          return text;
        }
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return "";
}

export function resolveFieldContainerFromHint(selectorHint: string): HTMLElement | null {
  try {
    const match = document.querySelector<HTMLElement>(selectorHint);
    if (!match) return null;
    if (match.matches(FIELD_CONTAINER_SELECTORS)) return match;
    return findFieldContainer(match) ?? match;
  } catch {
    return null;
  }
}

export function isYesNoButtonOptions(options: string[]): boolean {
  if (options.length < 2 || options.length > 4) return false;
  const normalized = options.map((option) => normalizeText(option));
  const hasYes = normalized.some((option) => /^yes$|^true$|^y$/.test(option));
  const hasNo = normalized.some((option) => /^no$|^false$|^n$/.test(option));
  return hasYes && hasNo;
}

export function findButtonRow(container: HTMLElement): HTMLElement | null {
  const directButtons = Array.from(container.querySelectorAll(":scope > button, :scope > div > button, :scope > span > button"))
    .filter((button) => isElementVisible(button));
  if (directButtons.length >= 2) {
    return directButtons[0].parentElement instanceof HTMLElement ? directButtons[0].parentElement : container;
  }

  const groups = Array.from(container.querySelectorAll<HTMLElement>("[role='group'], div, span"))
    .filter((group) => {
      const buttons = Array.from(group.querySelectorAll("button")).filter((button) => isElementVisible(button));
      return buttons.length >= 2 && buttons.length <= 6;
    })
    .sort((left, right) => left.querySelectorAll("button").length - right.querySelectorAll("button").length);

  return groups[0] ?? null;
}

export function isManagedChoiceInput(element: HTMLElement): boolean {
  if (element.closest("[data-applyos-choice-group]")) return true;
  if (element.closest(".ashby-application-form-field-entry")?.querySelector('[class*="_yesno_"]')) return true;

  const container = findFieldContainer(element);
  if (!container) return false;
  if (container.querySelector("[data-applyos-choice-group]")) return true;

  const row = findButtonRow(container);
  if (!row) return false;
  const options = uniqueStrings(
    Array.from(row.querySelectorAll("button"))
      .map((button) => button.textContent?.trim() || "")
      .filter(Boolean)
  );
  return isYesNoButtonOptions(options);
}

export function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
