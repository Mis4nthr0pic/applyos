import { extractJobFromPage } from "../adapters/extractJob";
import { enrichJobInfo } from "../adapters/enrichJobInfo";
import type { ContentMessage, ScanResult } from "../shared/types";
import { buildPageContext } from "./pageContext";
import {
  attachDependencyListeners,
  extractDetectedFields,
  findField,
  insertFieldValue,
  readFieldValue
} from "./fieldDetection";
import { startFieldAutoCapture } from "./fieldAutoCapture";
import { selectAdapter } from "../adapters";

let observer: MutationObserver | undefined;
let observerTimeout: number | undefined;
let removeDependencyListeners: (() => void) | undefined;
let stopFieldAutoCapture: (() => void) | undefined;
let currentPlatform = "generic";
let lastFieldSignature = "";

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse: (response: unknown) => void) => {
    if (message.type === "SCAN_PAGE") {
      scanPage(message.watchDynamicFields)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: getErrorMessage(error) }));
      return true;
    }
    if (message.type === "EXTRACT_JOB_INFO") {
      extractJobOnly()
        .then(sendResponse)
        .catch((error) => sendResponse({ error: getErrorMessage(error) }));
      return true;
    }
    if (message.type === "SET_DYNAMIC_WATCH") {
      if (message.enabled) startObserver();
      else stopObserver();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "INSERT_FIELD") {
      sendResponse(insertFieldValue(message.fieldId, message.selectorHint, message.value));
      return false;
    }
    if (message.type === "GET_FIELD_VALUE") {
      const element = findField(message.fieldId, message.selectorHint);
      sendResponse({ ok: Boolean(element), value: readFieldValue(element) });
      return false;
    }
    return false;
  }
);

async function extractJobOnly() {
  const context = buildPageContext();
  return extractJobFromPage(context);
}

async function scanPage(watchDynamicFields: boolean): Promise<ScanResult> {
  const context = buildPageContext();
  const adapter = selectAdapter(context);
  currentPlatform = adapter.id;
  const pageType = adapter.classify(context);
  const fields = await adapter.extractFields(context);
  const extracted = await extractJobFromPage(context);
  const jobInfo = extracted.jobInfo;
  lastFieldSignature = fieldSignature(fields);

  if (watchDynamicFields) startObserver();
  else stopObserver();

  stopFieldAutoCapture?.();
  stopFieldAutoCapture = startFieldAutoCapture(adapter.id);

  const hasApplyButton = context.buttons.some((button) => /\bapply\b/i.test(button));
  const listingNote = extracted.jobInfoFromListing
    ? " Stored job requirements were merged for this role."
    : "";
  const message =
    pageType === "job_listing_page" && fields.length === 0 && hasApplyButton
      ? `Job listing detected. Use Extract Job Info, click Apply manually, then Scan Page for form fields.${listingNote}`
      : fields.length === 0
        ? `No application fields were found.${extracted.jobInfoFromListing ? listingNote : " Extract job info first if this is a listing page."}`
        : extracted.jobInfoFromListing
          ? `Application form detected.${listingNote}`
          : undefined;

  return {
    context,
    pageType,
    platform: adapter.id,
    adapterName: adapter.name,
    jobInfo,
    fields,
    message,
    watching: Boolean(observer),
    jobInfoFromListing: extracted.jobInfoFromListing
  };
}

function startObserver(): void {
  stopObserver();
  removeDependencyListeners = attachDependencyListeners();
  observer = new MutationObserver(() => {
    const fields = extractDetectedFields(currentPlatform);
    const signature = fieldSignature(fields);
    if (signature !== lastFieldSignature) {
      lastFieldSignature = signature;
      notifyExtension({
        type: "APPLYOS_FIELDS_CHANGED",
        fields,
        status: "Fields changed"
      });
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "hidden", "style", "class"]
  });
  observerTimeout = window.setTimeout(() => {
    stopObserver();
    notifyExtension({ type: "APPLYOS_WATCH_STOPPED", status: "Stopped after 15 seconds" });
  }, 15_000);
}

function stopObserver(): void {
  observer?.disconnect();
  observer = undefined;
  removeDependencyListeners?.();
  removeDependencyListeners = undefined;
  if (observerTimeout) window.clearTimeout(observerTimeout);
  observerTimeout = undefined;
}

function fieldSignature(fields: ReturnType<typeof extractDetectedFields>): string {
  return fields
    .map((field) => `${field.fieldId}:${field.options?.join("|")}:${field.isVisible}:${field.isDisabled}`)
    .join(";");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown content script error";
}

function notifyExtension(message: Record<string, unknown>): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // The side panel may have been closed while a short dynamic watch was active.
  });
}

stopFieldAutoCapture = startFieldAutoCapture("generic");
