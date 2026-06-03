import type { PageContext } from "../shared/types";
import { extractJobPostingText, extractJobPostingTextFromDocument } from "./jobPostingText";

export function buildPageContextFromHtml(html: string, url: string): PageContext {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return buildPageContextFromDocument(doc, url);
}

function collectIframeSources(doc: Document): string[] {
  return Array.from(doc.querySelectorAll<HTMLIFrameElement>("iframe[src]"))
    .map((frame) => frame.src)
    .filter(Boolean)
    .slice(0, 30);
}

export function buildPageContextFromDocument(doc: Document, url: string): PageContext {
  const parsed = new URL(url);
  const meta: Record<string, string> = {};
  doc.querySelectorAll<HTMLMetaElement>("meta[name], meta[property]").forEach((item) => {
    const key = item.name || item.getAttribute("property");
    if (key && item.content) meta[key] = item.content;
  });

  const jsonLd: unknown[] = [];
  doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach((script) => {
    try {
      const parsedJson = JSON.parse(script.textContent || "null");
      if (Array.isArray(parsedJson)) jsonLd.push(...parsedJson);
      else if (parsedJson) jsonLd.push(parsedJson);
    } catch {
      // Invalid JSON-LD is ignored.
    }
  });

  const bodyText = (doc.body?.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 120_000);
  const jobPostingText = extractJobPostingTextFromDocument(doc);

  return {
    url,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    title: doc.title,
    bodyText,
    jobPostingText,
    hasForms: Boolean(doc.querySelector("form, input, textarea, select, [contenteditable='true']")),
    buttons: Array.from(
      doc.querySelectorAll<HTMLElement>("button, input[type='submit'], input[type='button'], [role='button']")
    )
      .map((button) => buttonText(button))
      .filter(Boolean)
      .slice(0, 100),
    links: Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((link) => `${link.textContent?.trim() || ""} ${link.href}`.trim())
      .filter(Boolean)
      .slice(0, 200),
    iframeSources: collectIframeSources(doc),
    meta,
    jsonLd
  };
}

export function buildPageContext(): PageContext {
  const meta: Record<string, string> = {};
  document.querySelectorAll<HTMLMetaElement>("meta[name], meta[property]").forEach((item) => {
    const key = item.name || item.getAttribute("property");
    if (key && item.content) meta[key] = item.content;
  });

  const jsonLd: unknown[] = [];
  document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]').forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent || "null");
      if (Array.isArray(parsed)) jsonLd.push(...parsed);
      else if (parsed) jsonLd.push(parsed);
    } catch {
      // Invalid page-owned JSON-LD is ignored.
    }
  });

  return {
    url: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    title: document.title,
    bodyText: visibleBodyText(),
    jobPostingText: extractJobPostingText(),
    hasForms: Boolean(document.querySelector("form, input, textarea, select, [contenteditable='true']")),
    buttons: Array.from(
      document.querySelectorAll<HTMLElement>("button, input[type='submit'], input[type='button'], [role='button']")
    )
      .filter(isElementVisible)
      .map((button) => buttonText(button))
      .filter(Boolean)
      .slice(0, 100),
    links: Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter(isElementVisible)
      .map((link) => `${link.textContent?.trim() || ""} ${link.href}`.trim())
      .filter(Boolean)
      .slice(0, 200),
    iframeSources: collectIframeSources(document),
    meta,
    jsonLd
  };
}

function visibleBodyText(): string {
  return (document.body?.innerText || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 120_000);
}

function buttonText(element: HTMLElement): string {
  if (element instanceof HTMLInputElement) return element.value || element.getAttribute("aria-label") || "";
  return element.innerText?.trim() || element.getAttribute("aria-label") || "";
}

export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) > 0.02 &&
    rect.width > 1 &&
    rect.height > 1 &&
    rect.bottom > -2000 &&
    rect.right > -2000
  );
}
