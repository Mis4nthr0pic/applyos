import type { ContentMessage } from "./types";

export const CONTENT_SCRIPT_FILE = "assets/content.js";

export const INJECTABLE_URL_PATTERNS = ["http://*/*", "https://*/*"] as const;

export function isInjectableTabUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function isRestrictedTabUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
}

export function isMissingContentScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Receiving end does not exist|Could not establish connection/i.test(message);
}

export async function pingTab(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch {
    return false;
  }
}

export async function ensureContentScript(tabId: number): Promise<void> {
  if (await pingTab(tabId)) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE]
  });

  if (!(await pingTab(tabId))) {
    throw new Error("Content script failed to attach to this tab.");
  }
}

export async function sendMessageToTab<T>(tabId: number, message: ContentMessage): Promise<T> {
  await ensureContentScript(tabId);
  return (await chrome.tabs.sendMessage(tabId, message)) as T;
}

export async function resolveTargetTabId(preferredTabId?: number): Promise<number> {
  if (preferredTabId) {
    const tab = await chrome.tabs.get(preferredTabId);
    if (!isInjectableTabUrl(tab.url)) {
      throw new Error("ApplyOS cannot run on this page type. Open a normal http(s) job or careers page.");
    }
    return preferredTabId;
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    throw new Error("No active browser tab found. Click the job page tab, then try again.");
  }
  if (isRestrictedTabUrl(tab.url) || !isInjectableTabUrl(tab.url)) {
    throw new Error(
      "ApplyOS cannot run on this page type. Click the job or careers tab in your browser window, then try again."
    );
  }
  return tab.id;
}

export async function injectIntoAllOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id && isInjectableTabUrl(tab.url))
      .map((tab) => ensureContentScript(tab.id!).catch(() => undefined))
  );
}

export type BackgroundMessage =
  | { type: "APPLYOS_RELAY_TO_TAB"; payload: ContentMessage; tabId?: number }
  | { type: "APPLYOS_ENSURE_ALL_TABS" };
