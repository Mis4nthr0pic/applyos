import type { FieldWidget } from "../shared/profileFieldValue";
import type { InsertResult } from "../shared/types";
import { optionMatches, optionMatchesCountry, optionMatchesLocation } from "./text";
import {
  findComboboxRoot,
  isComboboxInput,
  readComboboxDisplayValue
} from "./combobox";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setNativeInputValue(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function openCombobox(element: HTMLInputElement): void {
  element.focus();
  const root = findComboboxRoot(element) ?? element;
  const toggle = root.querySelector<HTMLButtonElement>(
    'button[aria-label*="flyout" i], button[aria-label*="Toggle" i], button[aria-label*="toggle" i]'
  );
  toggle?.click();
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function collectListboxOptions(): HTMLElement[] {
  const options = [
    ...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]'),
    ...document.querySelectorAll<HTMLElement>('[role="option"]')
  ];
  const seen = new Set<HTMLElement>();
  return options.filter((option) => {
    if (seen.has(option)) return false;
    seen.add(option);
    const text = option.textContent?.replace(/\s+/g, " ").trim();
    return Boolean(text && text.length > 1);
  });
}

function optionMatcherForWidget(widget: FieldWidget | undefined) {
  if (widget === "country_dropdown") return optionMatchesCountry;
  if (widget === "location_autocomplete") return optionMatchesLocation;
  return optionMatches;
}

function findMatchingOption(
  options: HTMLElement[],
  value: string,
  widget: FieldWidget | undefined
): HTMLElement | undefined {
  const match = optionMatcherForWidget(widget);
  return options.find((option) => match(option.textContent?.replace(/\s+/g, " ").trim() || "", value));
}

function clickOption(option: HTMLElement): void {
  const label = option.querySelector<HTMLElement>("label");
  (label ?? option).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  (label ?? option).click();
}

function pickTypeaheadSeed(value: string, widget: FieldWidget | undefined): string {
  const trimmed = value.trim();
  if (widget === "location_autocomplete") {
    const city = trimmed.split(",")[0]?.trim();
    return city && city.length >= 3 ? city : trimmed;
  }
  return trimmed;
}

export async function insertComboboxValue(
  element: HTMLInputElement,
  value: string,
  widget: FieldWidget = "combobox"
): Promise<InsertResult> {
  if (!value.trim()) return { ok: false, error: "Value is empty." };

  openCombobox(element);

  let options = collectListboxOptions();
  let target = findMatchingOption(options, value, widget);
  if (target) {
    clickOption(target);
    await sleep(150);
    const display = readComboboxDisplayValue(element);
    if (display) return { ok: true };
  }

  const seed = pickTypeaheadSeed(value, widget);
  setNativeInputValue(element, seed);
  await sleep(650);

  options = collectListboxOptions();
  target = findMatchingOption(options, value, widget);
  if (!target && widget === "location_autocomplete") {
    target = findMatchingOption(options, seed, widget);
  }
  if (!target && options.length === 1) {
    target = options[0];
  }

  if (!target) {
    return { ok: false, error: `No dropdown option matched "${value}". Pick the option manually once — ApplyOS can save it.` };
  }

  clickOption(target);
  await sleep(200);

  const display = readComboboxDisplayValue(element);
  const stuck = element.value.trim() || display;
  if (!stuck) {
    return { ok: false, error: "Combobox value did not stick after selecting an option." };
  }

  return { ok: true };
}

export function elementNeedsComboboxInsert(element: HTMLElement): boolean {
  return isComboboxInput(element);
}
