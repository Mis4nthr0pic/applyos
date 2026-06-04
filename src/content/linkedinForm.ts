import type { DetectedField, FieldType, InsertResult } from "../shared/types";
import { classifyField } from "./fieldClassifier";
import { buildContainerSelector, hashString } from "./formSemantics";
import { isElementVisible } from "./pageContext";
import { normalizeText, optionMatches, uniqueStrings } from "./text";

const FORM_ELEMENT_SELECTOR =
  "[data-test-form-element], .jobs-easy-apply-form-element";

const EASY_APPLY_ROOT_SELECTORS = [
  ".jobs-easy-apply-modal",
  "div[data-test-modal-id='easy-apply']",
  ".jobs-easy-apply-content"
];

export function findLinkedInEasyApplyRoot(): HTMLElement | null {
  for (const selector of EASY_APPLY_ROOT_SELECTORS) {
    const node = document.querySelector<HTMLElement>(selector);
    if (!node || !isElementVisible(node)) continue;
    return node.closest<HTMLElement>('[role="dialog"]') ?? node;
  }

  const dialog = document.querySelector<HTMLElement>(
    '[role="dialog"]:has(.jobs-easy-apply-content), [role="dialog"]:has([data-test-form-element])'
  );
  return dialog && isElementVisible(dialog) ? dialog : null;
}

export function isLinkedInEasyApplyContext(): boolean {
  return /linkedin\.com/i.test(window.location.hostname) && Boolean(findLinkedInEasyApplyRoot());
}

export function extractLinkedInQuestionLabel(formElement: HTMLElement): string {
  const title = formElement.querySelector<HTMLElement>(
    "[data-test-form-builder-radio-button-form-component__title], [data-test-text-entity-list-form-title], .jobs-easy-apply-form-section__label"
  );
  const labelSpan = formElement.querySelector<HTMLElement>("label span, legend span");
  const fromTitle = cleanLinkedInLabel(title?.textContent || labelSpan?.textContent || "");
  if (fromTitle.length >= 8) return fromTitle;

  const aria = formElement.querySelector<HTMLElement>("[aria-label]")?.getAttribute("aria-label");
  const fromAria = cleanLinkedInLabel(aria || "");
  if (fromAria.length >= 8) return fromAria;

  const clone = formElement.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "input, select, textarea, button, .fb-text-selectable__option, [data-test-text-selectable-option], fieldset"
    )
    .forEach((node) => node.remove());
  const fallback = cleanLinkedInLabel(clone.textContent || "");
  return fallback.length >= 8 ? fallback.split(/\n/)[0].trim().slice(0, 500) : "";
}

function cleanLinkedInLabel(value: string): string {
  return value.replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

function tagLinkedInChoiceGroup(
  formElement: HTMLElement,
  fieldId: string,
  kind: "linkedin-selectable"
): void {
  formElement.dataset.applyosFieldId = fieldId;
  formElement.dataset.applyosChoiceGroup = kind;
}

function buildLinkedInField(args: {
  fieldId: string;
  platform: string;
  label: string;
  fieldType: FieldType;
  options?: string[];
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
    fieldType: args.fieldType,
    options: args.options,
    required: args.required,
    value: args.value,
    isVisible: isElementVisible(args.container),
    isDisabled: args.container.getAttribute("aria-disabled") === "true",
    selectorHint: args.selectorHint,
    category: classifyField(args.label, args.fieldType)
  };
}

function isLinkedInFormRequired(formElement: HTMLElement, label: string): boolean {
  return (
    formElement.querySelector("[required], [aria-required='true']") !== null || /\*/.test(label)
  );
}

function extractLinkedInSelectableGroup(
  platform: string,
  formElement: HTMLElement,
  label: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  const options = Array.from(
    formElement.querySelectorAll<HTMLElement>(
      ".fb-text-selectable__option, [data-test-text-selectable-option]"
    )
  ).filter(isElementVisible);
  if (options.length < 2) return;

  const fieldId = `applyos-li-select-${hashString(label)}`;
  tagLinkedInChoiceGroup(formElement, fieldId, "linkedin-selectable");

  const duplicateKey = `linkedin-selectable:${label}`;
  if (seen.has(duplicateKey)) return;
  seen.add(duplicateKey);

  const optionLabels = uniqueStrings(
    options.map((option) => getLinkedInSelectableOptionText(option)).filter(Boolean)
  );
  if (optionLabels.length < 2) return;

  result.push(
    buildLinkedInField({
      fieldId,
      platform,
      label,
      fieldType: "radio",
      options: optionLabels,
      required: isLinkedInFormRequired(formElement, label),
      value: readLinkedInSelectableValue(formElement),
      selectorHint: buildContainerSelector(formElement, label),
      container: formElement
    })
  );
}

function extractLinkedInNativeRadioGroup(
  platform: string,
  formElement: HTMLElement,
  label: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  const fieldset =
    formElement.querySelector<HTMLElement>(
      'fieldset[data-test-form-builder-radio-button-form-component="true"]'
    ) || formElement.querySelector("fieldset");
  if (!fieldset) return;

  const radios = Array.from(fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
    (radio) => radio.name
  );
  if (radios.length < 2) return;

  const fieldId = `applyos-li-radio-${hashString(label)}`;
  radios.forEach((radio) => {
    radio.dataset.applyosFieldId = fieldId;
  });
  fieldset.dataset.applyosFieldId = fieldId;

  const duplicateKey = `radio:${radios[0].name}:${label}`;
  if (seen.has(duplicateKey)) return;
  seen.add(duplicateKey);

  const options = uniqueStrings(
    radios.map((radio) => getLinkedInNativeRadioLabel(radio) || radio.value).filter(Boolean)
  );

  const selected = fieldset.querySelector<HTMLInputElement>('input[type="radio"]:checked');

  result.push(
    buildLinkedInField({
      fieldId,
      platform,
      label,
      fieldType: "radio",
      options,
      required: isLinkedInFormRequired(formElement, label),
      value: selected ? getLinkedInNativeRadioLabel(selected) || selected.value : "",
      selectorHint: buildContainerSelector(formElement, label),
      container: fieldset
    })
  );
}

function extractLinkedInTextControl(
  platform: string,
  formElement: HTMLElement,
  label: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  const control =
    formElement.querySelector<HTMLInputElement>(
      "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox'])"
    ) || formElement.querySelector<HTMLTextAreaElement>("textarea");
  if (!control || !isElementVisible(control)) return;

  const fieldId = `applyos-li-${hashString(`${label}:${control.tagName}`)}`;
  control.dataset.applyosFieldId = fieldId;

  const duplicateKey = `${control.tagName}:${label}`;
  if (seen.has(duplicateKey)) return;
  seen.add(duplicateKey);

  const fieldType: FieldType =
    control instanceof HTMLTextAreaElement
      ? "textarea"
      : control.type === "number"
        ? "number"
        : control.type === "email"
          ? "email"
          : "text";

  result.push(
    buildLinkedInField({
      fieldId,
      platform,
      label,
      fieldType,
      required: isLinkedInFormRequired(formElement, label),
      value: control.value,
      selectorHint: control.id ? `#${CSS.escape(control.id)}` : `[data-applyos-field-id="${fieldId}"]`,
      container: control
    })
  );
}

function extractLinkedInSelectControl(
  platform: string,
  formElement: HTMLElement,
  label: string,
  seen: Set<string>,
  result: DetectedField[]
): void {
  const select = formElement.querySelector<HTMLSelectElement>("select");
  if (!select || !isElementVisible(select)) return;

  const fieldId = `applyos-li-select-dd-${hashString(label)}`;
  select.dataset.applyosFieldId = fieldId;

  const duplicateKey = `select:${label}`;
  if (seen.has(duplicateKey)) return;
  seen.add(duplicateKey);

  result.push(
    buildLinkedInField({
      fieldId,
      platform,
      label,
      fieldType: "select",
      options: uniqueStrings(
        Array.from(select.options)
          .map((option) => option.textContent?.trim() || option.value)
          .filter(Boolean)
      ),
      required: isLinkedInFormRequired(formElement, label),
      value: select.selectedOptions[0]?.textContent?.trim() || select.value,
      selectorHint: select.id ? `#${CSS.escape(select.id)}` : `[data-applyos-field-id="${fieldId}"]`,
      container: select
    })
  );
}

export function extractLinkedInEasyApplyFields(platform: string): DetectedField[] {
  const root = findLinkedInEasyApplyRoot();
  if (!root) return [];

  const seen = new Set<string>();
  const result: DetectedField[] = [];

  root.querySelectorAll<HTMLElement>(FORM_ELEMENT_SELECTOR).forEach((formElement) => {
    if (!isElementVisible(formElement)) return;

    const label = extractLinkedInQuestionLabel(formElement);
    if (!label || label.length < 8) return;

    extractLinkedInSelectableGroup(platform, formElement, label, seen, result);
    extractLinkedInNativeRadioGroup(platform, formElement, label, seen, result);
    extractLinkedInSelectControl(platform, formElement, label, seen, result);
    extractLinkedInTextControl(platform, formElement, label, seen, result);
  });

  return result;
}

export function getLinkedInSelectableOptionText(option: HTMLElement): string {
  const label = option.querySelector<HTMLElement>("label");
  return cleanLinkedInLabel(label?.textContent || option.textContent || "");
}

function getLinkedInNativeRadioLabel(radio: HTMLInputElement): string {
  if (radio.id) {
    const label = radio
      .closest("fieldset")
      ?.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(radio.id)}"]`);
    if (label?.textContent?.trim()) return cleanLinkedInLabel(label.textContent);
  }
  const wrap = radio.closest("label");
  if (wrap?.textContent?.trim()) return cleanLinkedInLabel(wrap.textContent);
  return "";
}

export function readLinkedInSelectableValue(formElement: HTMLElement): string {
  const selected = formElement.querySelector<HTMLElement>(
    '.fb-text-selectable__option--selected, .fb-text-selectable__option.selected, [data-test-text-selectable-option][aria-checked="true"]'
  );
  if (selected) return getLinkedInSelectableOptionText(selected);

  return (
    Array.from(
      formElement.querySelectorAll<HTMLElement>(
        ".fb-text-selectable__option, [data-test-text-selectable-option]"
      )
    )
      .filter(
        (option) =>
          /selected|checked|active/i.test(option.className) ||
          option.getAttribute("aria-checked") === "true"
      )
      .map(getLinkedInSelectableOptionText)
      .find(Boolean) || ""
  );
}

export function insertLinkedInSelectableValue(formElement: HTMLElement, value: string): InsertResult {
  const options = Array.from(
    formElement.querySelectorAll<HTMLElement>(".fb-text-selectable__option, [data-test-text-selectable-option]")
  );

  const target = options.find((option) =>
    optionMatches(getLinkedInSelectableOptionText(option), value)
  );
  if (!target) {
    return { ok: false, error: `No confident LinkedIn option match for "${value}".` };
  }

  const clickTarget = target.querySelector<HTMLElement>("label") || target;
  clickTarget.click();
  return { ok: true };
}

export function enhanceLinkedInFieldLabel(container: HTMLElement, input?: HTMLElement | null): string {
  const formElement = (input || container).closest<HTMLElement>(FORM_ELEMENT_SELECTOR);
  if (!formElement) return "";
  return extractLinkedInQuestionLabel(formElement);
}
