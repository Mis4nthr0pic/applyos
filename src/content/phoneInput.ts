import type { InsertResult } from "../shared/types";
import { parsePhoneNumber, type ParsedPhone } from "../shared/phoneFormat";
import { optionMatches, optionMatchesCountry } from "./text";

function dispatchInputEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeInputValue(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  dispatchInputEvents(element);
}

export function isCompositePhoneInput(element: HTMLElement): boolean {
  return (
    element instanceof HTMLInputElement &&
    (element.classList.contains("iti__tel-input") ||
      Boolean(element.closest("fieldset.phone-input, .phone-input, .iti")))
  );
}

export function isPhoneWidgetChrome(element: HTMLElement): boolean {
  return Boolean(
    element.closest(".phone-input__country, .iti__dropdown-content, .iti__country-list") ||
      element.classList.contains("iti__search-input") ||
      (element.id === "country" && element.closest(".phone-input"))
  );
}

function dialCodesFromOptions(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .map((option) => option.textContent?.match(/\+(\d{1,4})\s*$/)?.[1])
    .filter((value): value is string => Boolean(value));
}

function reparsedPhone(raw: string, countryHint?: string): ParsedPhone {
  const parsed = parsePhoneNumber(raw, countryHint);
  if (parsed.dialCode) return parsed;
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const split = dialCodesFromOptions()
    .sort((left, right) => right.length - left.length)
    .find((code) => digits.startsWith(code) && digits.length > code.length + 4);
  if (split) {
    return {
      dialCode: split,
      national: digits.slice(split.length),
      countryName: parsed.countryName,
      e164: `+${split}${digits.slice(split.length)}`
    };
  }
  return parsed;
}

function openReactSelect(combobox: HTMLInputElement): void {
  combobox.focus();
  const toggle = combobox
    .closest(".select-shell, .select")
    ?.querySelector<HTMLButtonElement>('button[aria-label*="flyout" i], button[aria-label*="Toggle" i]');
  toggle?.click();
  combobox.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}

function selectReactSelectOption(combobox: HTMLInputElement, parsed: ParsedPhone): boolean {
  openReactSelect(combobox);

  const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  const match = options.find((option) => phoneOptionMatches(option.textContent || "", parsed));
  if (!match) return false;

  match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  match.click();
  combobox.blur();
  return true;
}

function phoneOptionMatches(optionText: string, parsed: ParsedPhone): boolean {
  const normalized = optionText.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.toLowerCase() === "select...") return false;
  if (parsed.dialCode && normalized.includes(`+${parsed.dialCode}`)) return true;
  if (parsed.countryName && optionMatchesCountry(normalized, parsed.countryName)) return true;
  if (parsed.countryName && optionMatches(normalized, parsed.countryName)) return true;
  return false;
}

function selectItiCountry(phoneInput: HTMLInputElement, parsed: ParsedPhone): boolean {
  const container = phoneInput.closest(".iti");
  if (!container) return false;

  container.querySelector<HTMLButtonElement>(".iti__selected-country")?.click();

  const listItem =
    (parsed.dialCode &&
      container.querySelector<HTMLElement>(`.iti__country[data-dial-code="${parsed.dialCode}"]`)) ||
    [...container.querySelectorAll<HTMLElement>(".iti__country")].find((item) =>
      parsed.countryName ? optionMatches(item.textContent || "", parsed.countryName) : false
    );

  if (!listItem) {
    container.querySelector<HTMLButtonElement>(".iti__selected-country")?.click();
    return false;
  }

  listItem.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  listItem.click();
  return true;
}

function setNationalPhoneNumber(phoneInput: HTMLInputElement, national: string): void {
  phoneInput.focus();
  setNativeInputValue(phoneInput, national);
  phoneInput.blur();
}

export function insertPhoneFieldValue(
  element: HTMLInputElement,
  rawValue: string,
  countryHint?: string
): InsertResult {
  const parsed = reparsedPhone(rawValue, countryHint);
  if (!parsed.national && !parsed.dialCode) {
    return { ok: false, error: "Phone number is empty." };
  }

  const fieldset = element.closest("fieldset.phone-input, .phone-input");
  const combobox = fieldset?.querySelector<HTMLInputElement>(
    '.phone-input__country input[role="combobox"], #country.select__input'
  );

  if (parsed.dialCode || parsed.countryName) {
    if (combobox) selectReactSelectOption(combobox, parsed);
    selectItiCountry(element, parsed);
  }

  setNationalPhoneNumber(element, parsed.national || rawValue.replace(/[^\d]/g, ""));

  const digits = (parsed.national || rawValue).replace(/\D/g, "");
  if (digits && !element.value.replace(/\D/g, "").includes(digits)) {
    return { ok: false, error: "Phone number did not stick after country selection." };
  }

  return { ok: true };
}

export function readPhoneFieldValue(element: HTMLInputElement): string {
  const national = element.value.trim();
  const fieldset = element.closest("fieldset.phone-input, .phone-input");
  const selected =
    fieldset?.querySelector<HTMLElement>('[class*="single-value"], [class*="select__single-value"]')
      ?.textContent || "";
  const dial = selected.match(/\+(\d{1,4})/)?.[1];
  if (dial && national) return `+${dial}${national.replace(/\D/g, "")}`;
  return national;
}
