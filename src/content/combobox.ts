import { isElementVisible } from "./pageContext";

const COMBOBOX_ROOT_SELECTORS =
  '[class*="select__control"], [class*="select-container"], [class*="react-select"], [role="combobox"]';

const LOCATION_LABEL_PATTERN = /\b(country|nationality|residence|citizenship|region)\b/i;
const LOCATION_AUTOCOMPLETE_LABEL = /\b(current location|your location|where are you located|^location$)\b/i;

export function isComboboxInput(element: HTMLElement): boolean {
  if (element.getAttribute("role") === "combobox") return true;
  if (element.getAttribute("aria-autocomplete") === "list") return true;
  if (element.closest(COMBOBOX_ROOT_SELECTORS)) return true;
  return /\bselect__input\b/.test(element.className);
}

export function findComboboxRoot(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(COMBOBOX_ROOT_SELECTORS);
}

export function isComboboxOpen(element: HTMLElement): boolean {
  const root = findComboboxRoot(element) ?? element;
  const combobox = root.matches('[role="combobox"]')
    ? root
    : root.querySelector<HTMLElement>('[role="combobox"]');
  return combobox?.getAttribute("aria-expanded") === "true";
}

export function readComboboxDisplayValue(element: HTMLElement): string {
  const root = findComboboxRoot(element);
  if (!root) return "";

  const selectedLabel = root.querySelector<HTMLElement>(
    '[class*="single-value"], [class*="multi-value__label"], [class*="select__single-value"]'
  );
  const labelText = selectedLabel?.textContent?.replace(/\s+/g, " ").trim();
  if (labelText) return labelText;

  const chip = root.querySelector<HTMLElement>('[class*="value-container"] [class*="value"]');
  const chipText = chip?.textContent?.replace(/\s+/g, " ").trim();
  if (chipText && chipText.length > 2) return chipText;

  if (element instanceof HTMLInputElement && element.value.trim()) {
    return element.value.trim();
  }

  return "";
}

export function isIncompleteLocationValue(label: string, value: string): boolean {
  if (LOCATION_AUTOCOMPLETE_LABEL.test(label)) {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.length < 4) return true;
    return false;
  }
  if (!LOCATION_LABEL_PATTERN.test(label)) return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 3) return true;
  if (/^[A-Z]{2,3}$/i.test(trimmed)) return true;
  return false;
}

export function shouldDeferComboboxCapture(element: HTMLElement, label: string, value: string): boolean {
  if (!isComboboxInput(element) && !findComboboxRoot(element)) return false;
  if (isComboboxOpen(element)) return true;
  if (isIncompleteLocationValue(label, value)) return true;

  if (element instanceof HTMLInputElement && document.activeElement === element) {
    const display = readComboboxDisplayValue(element);
    if (!display || display === element.value.trim()) {
      return true;
    }
  }

  return false;
}

export function isComboboxOptionElement(element: HTMLElement): boolean {
  return element.getAttribute("role") === "option" || Boolean(element.closest('[role="listbox"] [role="option"]'));
}

export function isVisibleComboboxOption(element: HTMLElement): boolean {
  return isComboboxOptionElement(element) && isElementVisible(element);
}
