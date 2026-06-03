import type { PageContext } from "../shared/types";

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
