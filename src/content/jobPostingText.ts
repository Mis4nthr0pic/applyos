import type { PageContext } from "../shared/types";
import { findJobPosting } from "../adapters/classifier";

const JOB_POSTING_SELECTORS = [
  '[data-qa="job-description"]',
  '[data-testid="job-description"]',
  ".job__description",
  ".job-description",
  ".job-post",
  '[class*="JobDescription"]',
  '[class*="JobPost"]',
  '[class*="job-description"]',
  ".posting-page .content",
  ".posting .content",
  ".opening .content",
  "#content .job-post",
  "main article"
];

const APPLICATION_FORM_SELECTORS = [
  "#application",
  "#application_form",
  "#apply-form",
  "form#application_form",
  'form[action*="/applications"]',
  'form[action*="/apply"]',
  '[data-testid="application-form"]',
  ".ashby-application-form",
  ".application-form",
  '[class*="ApplicationForm"]',
  '[class*="application--form"]',
  '[class*="application-form"]',
  "section#application",
  ".job-application",
  "#main-application-form"
];

const APPLICATION_HEADING_PATTERNS = [
  /\n#+\s*apply for this job\b/i,
  /\napply for this job\s*\n/i,
  /\n#+\s*submit application\b/i,
  /\nquick apply with mygreenhouse\b/i,
  /\n#+\s*application form\b/i
];

function cleanText(text: string | null | undefined): string {
  return (text || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractJobPostingTextFromDocument(doc: Document): string {
  for (const selector of JOB_POSTING_SELECTORS) {
    try {
      const element = doc.querySelector(selector);
      const text = cleanText(element?.textContent);
      if (text.length >= 200) return text.slice(0, 80_000);
    } catch {
      // Invalid selector — try the next one.
    }
  }

  const withoutForms = extractBodyTextExcludingApplicationForms(doc);
  if (withoutForms.length >= 200) return withoutForms;

  const split = splitBeforeApplicationHeading(doc.body?.textContent || "");
  if (split.length >= 200) return split;

  return "";
}

export function extractJobPostingText(): string {
  return extractJobPostingTextFromDocument(document);
}

function extractBodyTextExcludingApplicationForms(doc: Document): string {
  if (!doc.body) return "";
  const clone = doc.body.cloneNode(true) as HTMLElement;

  for (const selector of APPLICATION_FORM_SELECTORS) {
    try {
      clone.querySelectorAll(selector).forEach((element) => element.remove());
    } catch {
      // Invalid selector — try the next one.
    }
  }

  clone.querySelectorAll("form").forEach((form) => {
    const text = form.textContent?.toLowerCase() || "";
    if (/\b(first name|last name|resume|cover letter|submit application)\b/.test(text)) {
      form.remove();
    }
  });

  return cleanText(clone.textContent).slice(0, 80_000);
}

function splitBeforeApplicationHeading(fullText: string): string {
  for (const pattern of APPLICATION_HEADING_PATTERNS) {
    const match = fullText.match(pattern);
    if (match?.index != null && match.index >= 200) {
      return cleanText(fullText.slice(0, match.index)).slice(0, 80_000);
    }
  }
  return "";
}

export function hasJobPostingContent(
  context: Pick<PageContext, "jobPostingText" | "bodyText" | "jsonLd">
): boolean {
  if ((context.jobPostingText?.trim().length ?? 0) >= 200) return true;
  if (findJobPosting(context.jsonLd)) return true;

  const haystack = (context.jobPostingText || context.bodyText.slice(0, 15_000)).toLowerCase();
  const signals = [
    "requirements:",
    "qualifications",
    "responsibilities",
    "who we are",
    "about the role",
    "what you'll do",
    "what you will do",
    "your role:"
  ];
  return signals.filter((signal) => haystack.includes(signal)).length >= 2;
}
