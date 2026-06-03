import { PROFILE_LINK_PLATFORM_PATTERN } from "../shared/profileLinkFields";
import { isElementVisible } from "./pageContext";
import { normalizeText, uniqueStrings } from "./text";

const NARROW_FIELD_CONTAINER_SELECTORS =
  ".field, .application-question, .application-field, .form-field, .form-group, .ashby-application-form-field-entry";

/** Broader fallbacks when narrow wrappers are missing. */
export const FIELD_CONTAINER_SELECTORS = [
  NARROW_FIELD_CONTAINER_SELECTORS,
  "fieldset",
  "[role='group']",
  "[role='radiogroup']",
  ".application--questions",
  ".question",
  ".text-input-wrapper",
  "[data-field-path]",
  "[data-automation-id]",
  "[data-testid*='question']",
  "[data-testid*='field']"
].join(",");

const YES_NO_OPTION_PATTERN = /^(yes|no|true|false|y|n)$/i;

export function findFieldContainer(element: HTMLElement): HTMLElement | null {
  const narrow = element.closest<HTMLElement>(NARROW_FIELD_CONTAINER_SELECTORS);
  if (narrow) return narrow;
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

function extractAshbyQuestionLabel(input: HTMLElement): string {
  const entry = input.closest(".ashby-application-form-field-entry");
  if (!entry) return "";
  const title = entry.querySelector<HTMLElement>(".ashby-application-form-question-title");
  return cleanLabelText(title?.innerText || title?.textContent || "");
}

function extractLeverApplicationLabel(input: HTMLElement): string {
  const fieldRoot = input.closest(".application-field");
  const labelNode =
    fieldRoot?.parentElement?.querySelector<HTMLElement>(".application-label .text") ||
    fieldRoot?.parentElement?.querySelector<HTMLElement>(".application-label") ||
    input.closest("li")?.querySelector<HTMLElement>(".application-label .text, .application-label");
  return cleanLabelText(labelNode?.innerText || labelNode?.textContent || "");
}

export function extractQuestionLabel(_container: HTMLElement, input?: HTMLElement | null): string {
  if (!input) return pickBestQuestionLabel(collectContainerLabels(_container));

  const leverLabel = extractLeverApplicationLabel(input);
  if (leverLabel.length >= 8) return leverLabel.slice(0, 500);

  const ashbyLabel = extractAshbyQuestionLabel(input);
  if (ashbyLabel.length >= 8) return ashbyLabel.slice(0, 500);

  const scoped = extractInputScopedLabel(input);
  if (scoped && !isPlaceholderLabel(scoped)) return scoped;

  const fieldRoot = findFieldContainer(input);
  if (fieldRoot) {
    const ashbyTitle = extractAshbyQuestionLabel(input);
    if (ashbyTitle.length >= 8) return ashbyTitle.slice(0, 500);

    const fromField = pickBestQuestionLabel(collectDirectFieldLabels(fieldRoot, input));
    if (fromField && !isPlaceholderLabel(fromField)) return fromField;
  }

  return pickBestQuestionLabel([
    ...collectAriaLabels(input).filter((text) => !isPlaceholderLabel(text)),
    ...collectContainerLabels(fieldRoot ?? _container)
  ]);
}

function isPlaceholderLabel(label: string): boolean {
  return /^(type here|enter text|enter your|select|choose|search)\b/i.test(label.trim());
}

function extractInputScopedLabel(input: HTMLElement): string {
  if (input.id) {
    const explicit = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
    const explicitText = cleanLabelText(explicit?.innerText || "");
    if (explicitText.length >= 3) return explicitText.slice(0, 500);
  }

  const parentLabel = input.closest("label");
  const parentText = cleanLabelText(parentLabel?.innerText || "");
  if (parentText.length >= 3) return parentText.slice(0, 500);

  const previousSiblingLabel = extractPreviousSiblingLabel(input);
  if (previousSiblingLabel) return previousSiblingLabel.slice(0, 500);

  let current: HTMLElement | null = input.parentElement;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLElement) {
        if (sibling.matches("label, .label, .application-label, .field-label")) {
          const text = cleanLabelText(sibling.innerText || sibling.textContent || "");
          if (text.length >= 8) return text.slice(0, 500);
        }
        const text = cleanLabelText(sibling.innerText || sibling.textContent || "");
        if (text.length >= 12 && text.length <= 300 && !YES_NO_OPTION_PATTERN.test(text)) {
          return text.slice(0, 500);
        }
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return "";
}

function collectDirectFieldLabels(fieldRoot: HTMLElement, input: HTMLElement): string[] {
  const candidates: string[] = [];

  Array.from(
    fieldRoot.querySelectorAll<HTMLElement>(
      ":scope > label, :scope > .label, :scope > .application-label, :scope > .application-label--required, :scope > .field-label, :scope > legend, .ashby-application-form-question-title"
    )
  )
    .filter((node) => node !== input && isElementVisible(node))
    .map((node) => cleanLabelText(node.innerText || node.textContent || ""))
    .filter((text) => text.length >= 8)
    .forEach((text) => candidates.push(text));

  return candidates;
}

function collectAriaLabels(input: HTMLElement): string[] {
  const candidates: string[] = [];
  const labelledBy = input.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => cleanLabelText(document.getElementById(id)?.textContent || ""))
      .join(" ")
      .trim();
    if (label) candidates.push(label);
  }

  const ariaLabel = cleanLabelText(input.getAttribute("aria-label") || "");
  if (ariaLabel) candidates.push(ariaLabel);

  const placeholder = cleanLabelText(input.getAttribute("placeholder") || "");
  if (placeholder.length >= 12) candidates.push(placeholder);

  return candidates;
}

function collectContainerLabels(container: HTMLElement): string[] {
  const heading = findNearbyHeading(container);
  return heading ? [heading] : [];
}

function extractPreviousSiblingLabel(input: HTMLElement): string {
  let sibling = input.previousElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement) {
      const text = cleanLabelText(sibling.innerText || sibling.textContent || "");
      if (text.length >= 8 && text.length <= 300 && !YES_NO_OPTION_PATTERN.test(text)) {
        return text;
      }
    }
    sibling = sibling.previousElementSibling;
  }
  return "";
}

function cleanLabelText(value: string): string {
  return value
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestQuestionLabel(candidates: string[]): string {
  const cleaned = uniqueStrings(
    candidates.map((candidate) => cleanLabelText(candidate)).filter((candidate) => candidate.length >= 3)
  );
  if (!cleaned.length) return "";

  cleaned.sort((left, right) => scoreQuestionLabel(right) - scoreQuestionLabel(left));
  return cleaned[0].slice(0, 500);
}

function scoreQuestionLabel(label: string): number {
  let score = Math.min(label.length, 120);
  if (label.includes("?")) score += 40;
  if (/\b(how many|why|what|describe|tell us|reason|experience|visa|global markets|looking for)\b/i.test(label)) {
    score += 30;
  }
  if (/\b(linkedin profile|linkedin url|github profile|portfolio url|resume|cover letter)\b/i.test(label)) {
    score -= 80;
  }
  if (PROFILE_LINK_PLATFORM_PATTERN.test(label) && /\b(profile|url|link|username|handle|account|channel)\b/i.test(label)) {
    score -= 80;
  }
  if (/^(type here|enter|select|choose|search)\b/i.test(label)) {
    score -= 100;
  }
  if (/\b(great at|ideal role|tell us what you|what you.re great|strengths)\b/i.test(label)) {
    score += 35;
  }
  if (/\b(linkedin profile|what s reason|reason you are looking)\b/i.test(label) && label.includes("?")) {
    score -= 100;
  }
  if (PROFILE_LINK_PLATFORM_PATTERN.test(label) && label.includes("?")) {
    score -= 60;
  }
  return score;
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
