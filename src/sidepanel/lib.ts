import type {
  ContentMessage,
  DetectedField,
  FieldCategory,
  InsertResult,
  UserProfile
} from "../shared/types";

export async function sendToActiveTab<T>(message: ContentMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage({
    type: "APPLYOS_RELAY_TO_TAB",
    payload: message
  })) as T | { error?: string };

  if (response && typeof response === "object" && "error" in response && response.error) {
    throw new Error(response.error);
  }
  return response as T;
}

export async function ensureAllTabsConnected(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "APPLYOS_ENSURE_ALL_TABS" })) as {
    ok?: boolean;
    error?: string;
  };
  if (response?.error) throw new Error(response.error);
}

export function profileValueForField(
  field: DetectedField,
  profile?: UserProfile
): string | undefined {
  if (!profile) return undefined;
  const map: Partial<Record<FieldCategory, keyof UserProfile>> = {
    first_name: "firstName",
    last_name: "lastName",
    full_name: "fullName",
    email: "email",
    phone: "phone",
    country: "country",
    state: "state",
    city: "city",
    linkedin: "linkedinUrl",
    github: "githubUrl",
    portfolio: "portfolioUrl",
    website: "websiteUrl",
    work_authorization: "workAuthorization",
    visa_sponsorship: "visaSponsorship",
    legal_authorization: "workAuthorization",
    salary: "salaryExpectation",
    start_date: "startDate"
  };
  const key = field.category ? map[field.category] : undefined;
  const value = key ? profile[key] : undefined;
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function insertIntoField(field: DetectedField, value: string): Promise<InsertResult> {
  return sendToActiveTab<InsertResult>({
    type: "INSERT_FIELD",
    fieldId: field.fieldId,
    selectorHint: field.selectorHint,
    value,
    frameId: field.frameId
  });
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}

export function downloadText(filename: string, data: string, type = "text/plain"): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await file.text()) as Record<string, unknown>;
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function recommendationLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
