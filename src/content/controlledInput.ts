/** Commit values into React / Preact controlled inputs (Ashby, many modern ATS forms). */

import { isReactControlledFormHost } from "../shared/reactFormHosts";

type TrackedInput = (HTMLInputElement | HTMLTextAreaElement) & {
  _valueTracker?: { setValue: (value: string) => void };
};

function nativeValueSetter(element: HTMLInputElement | HTMLTextAreaElement) {
  const prototype =
    element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  return Object.getOwnPropertyDescriptor(prototype, "value")?.set;
}

function dispatchInputChange(element: HTMLInputElement | HTMLTextAreaElement, value: string, inputType: string): void {
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      data: value
    })
  );
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function commitWithTracker(
  element: TrackedInput,
  nextValue: string,
  previousValue: string,
  inputType: string
): void {
  const setter = nativeValueSetter(element);
  setter?.call(element, nextValue);
  const tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(previousValue);
  }
  dispatchInputChange(element, nextValue, inputType);
}

function typeCharacterByCharacter(element: TrackedInput, value: string): void {
  const setter = nativeValueSetter(element);
  element.focus();

  let previous = element.value;
  setter?.call(element, "");
  if (element._valueTracker) {
    element._valueTracker.setValue(previous);
  }
  dispatchInputChange(element, "", "deleteContentBackward");

  for (const char of value) {
    previous = element.value;
    const next = previous + char;
    setter?.call(element, next);
    if (element._valueTracker) {
      element._valueTracker.setValue(previous);
    }
    dispatchInputChange(element, next, "insertText");
  }

  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

/** Set a controlled input so framework state (not only the DOM) updates. */
export function setControlledInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const trimmed = value.trim();
  if (!trimmed && element.value.trim()) {
    const setter = nativeValueSetter(element);
    const previous = element.value;
    const tracked = element as TrackedInput;
    element.focus();
    setter?.call(element, "");
    if (tracked._valueTracker) {
      tracked._valueTracker.setValue(previous);
    }
    dispatchInputChange(element, "", "deleteContentBackward");
    element.blur();
    return;
  }

  if (!trimmed) return;

  if (isReactControlledFormHost()) {
    typeCharacterByCharacter(element, value);
    return;
  }

  element.focus();
  const previous = element.value;
  commitWithTracker(element, value, previous, "insertFromPaste");
  element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
}

export function readCommittedInputValue(element: HTMLInputElement | HTMLTextAreaElement): string {
  return element.value.trim();
}
