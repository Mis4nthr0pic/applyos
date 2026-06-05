import type { FieldCategory } from "./types";

/** Ashby built-in application fields use stable data-field-path ids. */
const ASHBY_SYSTEM_CATEGORY: Record<string, FieldCategory> = {
  _systemfield_name: "full_name",
  _systemfield_email: "email",
  _systemfield_location: "city",
  _systemfield_resume: "resume"
};

export function ashbySystemFieldCategory(element: HTMLElement): FieldCategory | undefined {
  const path = element.closest<HTMLElement>("[data-field-path]")?.getAttribute("data-field-path");
  if (!path) return undefined;
  return ASHBY_SYSTEM_CATEGORY[path];
}

export function ashbySystemFieldSelector(path: string): string {
  return `[data-field-path="${path}"]`;
}
