import {
  injectIntoAllOpenTabs,
  isInjectableTabUrl,
  resolveTargetTabId,
  sendMessageToTab,
  type BackgroundMessage
} from "../shared/contentScriptAccess";
import { saveFieldAnswer } from "../shared/saveFieldAnswer";
import type { DetectedField } from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Side panel behavior is best-effort on older Chromium versions.
  });
  injectIntoAllOpenTabs().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  injectIntoAllOpenTabs().catch(() => undefined);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isInjectableTabUrl(tab.url)) return;
  sendMessageToTab(tabId, { type: "PING" }).catch(() => undefined);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs
    .get(tabId)
    .then((tab) => {
      if (!isInjectableTabUrl(tab.url)) return;
      sendMessageToTab(tabId, { type: "PING" }).catch(() => undefined);
    })
    .catch(() => undefined);
});

type RuntimeMessage =
  | BackgroundMessage
  | { type: "APPLYOS_FIELD_ANSWERED"; field: DetectedField; value: string };

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "APPLYOS_FIELD_ANSWERED") {
      saveFieldAnswer(message.field, message.value)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to save screening answer."
        })
      );
    return true;
  }

  if (message.type === "APPLYOS_ENSURE_ALL_TABS") {
      injectIntoAllOpenTabs()
        .then(() => sendResponse({ ok: true }))
        .catch((error) =>
          sendResponse({ ok: false, error: error instanceof Error ? error.message : "Injection failed." })
        );
      return true;
    }

  if (message.type === "APPLYOS_RELAY_TO_TAB") {
    resolveTargetTabId(message.tabId)
      .then((tabId) => sendMessageToTab(tabId, message.payload))
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          error: error instanceof Error ? error.message : "ApplyOS could not reach the active tab."
        })
      );
    return true;
  }

  return false;
});
