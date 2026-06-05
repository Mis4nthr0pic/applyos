import type { FieldWidget } from "../shared/profileFieldValue";
import { inferFieldWidget } from "../shared/profileFieldValue";
import { labelRequestsProfileLink } from "../shared/profileLinkFields";
import { isComboboxInput } from "./combobox";
import { isPhoneWidgetChrome } from "./phoneInput";

export function buildWidgetHint(element: HTMLElement): string {
  const container = element.closest<HTMLElement>("[data-field-path], .phone-input, fieldset.phone-input");
  const parts = [
    container?.getAttribute("data-field-path"),
    container?.className,
    element.id ? `#${element.id}` : "",
    element.getAttribute("role") ? `role=${element.getAttribute("role")}` : "",
    element.className
  ].filter(Boolean);
  return parts.join(" ");
}

export function resolveFieldWidget(element: HTMLElement, label: string): FieldWidget {
  if (labelRequestsProfileLink(label)) return "default";

  if (isPhoneWidgetChrome(element) || element.closest(".phone-input__country")) {
    return "country_dropdown";
  }

  const fieldPath = element.closest<HTMLElement>("[data-field-path]")?.getAttribute("data-field-path") ?? "";
  const normalized = label.trim();

  if (fieldPath === "_systemfield_location") return "location_autocomplete";

  if (isComboboxInput(element)) {
    if (/\b(country|nationality|citizenship)\b/i.test(normalized)) return "country_dropdown";
    if (/\b(location|city|where do you live|current location)\b/i.test(normalized)) {
      return "location_autocomplete";
    }
    return "combobox";
  }

  if (element instanceof HTMLSelectElement && /\b(country|nationality)\b/i.test(normalized)) {
    return "country_dropdown";
  }

  if (
    /\b(location|current location|where do you live)\b/i.test(normalized) &&
    !/\b(job location|work location|office location)\b/i.test(normalized)
  ) {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? "location_text"
      : "location_autocomplete";
  }

  return inferFieldWidget(normalized, buildWidgetHint(element));
}
