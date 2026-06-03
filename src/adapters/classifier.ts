import type { PageContext, PageType } from "../shared/types";
import { CAREER_KEYWORDS, normalizeText } from "../content/text";

export function classifyPage(context: PageContext): PageType {
  const haystack = normalizeText(
    [context.url, context.title, context.bodyText.slice(0, 20_000), ...context.buttons].join(" ")
  );
  const jobPosting = findJobPosting(context.jsonLd);
  const hasApplicationFields = context.hasForms && /\b(submit application|resume|cover letter|first name|email)\b/.test(haystack);
  const hasApplyButton = context.buttons.some((button) => /\b(apply|submit application)\b/i.test(button));
  const careerScore = CAREER_KEYWORDS.filter((keyword) => haystack.includes(keyword)).length;
  const manyJobLinks = context.links.filter((link) => /\b(job|position|opening|apply)\b/i.test(link)).length >= 5;

  if (hasApplicationFields) return "job_application_form";
  if (jobPosting || (hasApplyButton && careerScore >= 2)) return "job_listing_page";
  if (manyJobLinks && careerScore >= 2) return "company_careers_page";
  if (/\b(search jobs|job search|open positions|all jobs)\b/.test(haystack)) return "job_search_results_page";
  return "unknown_page";
}

export function findJobPosting(values: unknown[]): Record<string, unknown> | undefined {
  const queue = [...values];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    if (record["@type"] === "JobPosting") return record;
    for (const child of Object.values(record)) {
      if (Array.isArray(child)) queue.push(...child);
      else if (child && typeof child === "object") queue.push(child);
    }
  }
  return undefined;
}
