import { dedupeDetectedFields } from "./dedupeFields";
import { mergeJobInfo } from "../adapters/listingResolver";
import type { DetectedField, PageContext, PageType, ScanResult } from "./types";

export interface FrameScanResult extends ScanResult {
  frameId: number;
}

function pickLongerText(left?: string, right?: string): string {
  const leftText = left?.trim() ?? "";
  const rightText = right?.trim() ?? "";
  return leftText.length >= rightText.length ? leftText : rightText;
}

export function looksLikeEmbeddedAtsPage(
  tabUrl: string,
  bodyText?: string,
  context?: Pick<PageContext, "iframeSources" | "pathname">
): boolean {
  if (looksLikeNativeAtsPage(tabUrl)) return false;

  const haystack = `${tabUrl} ${bodyText ?? ""}`.toLowerCase();
  if (/greenhouse\.io|gh_jid|grnhse|lever-app|ashbyhq\.com/i.test(haystack)) return true;

  const iframeHaystack = (context?.iframeSources ?? []).join(" ").toLowerCase();
  if (/greenhouse\.io|gh_jid|grnhse|lever\.co|ashbyhq\.com/i.test(iframeHaystack)) return true;

  if (/\/apply(?:\/|$|\?|#)/i.test(context?.pathname ?? tabUrl)) {
    if (/stripe\.com\/jobs|fireblocks\.com\/careers|\.com\/careers/i.test(tabUrl)) return true;
  }

  return false;
}

/** Native inline forms (e.g. Gem) — short poll only, not embedded iframe ATS. */
export function looksLikeInlineApplicationFormPage(tabUrl: string): boolean {
  try {
    return new URL(tabUrl).hostname.toLowerCase() === "jobs.gem.com";
  } catch {
    return /jobs\.gem\.com/i.test(tabUrl);
  }
}

export function looksLikeNativeAtsPage(tabUrl: string): boolean {
  try {
    const host = new URL(tabUrl).hostname.toLowerCase();
    return (
      host === "greenhouse.io" ||
      host.endsWith(".greenhouse.io") ||
      host === "lever.co" ||
      host.endsWith(".lever.co") ||
      host === "ashbyhq.com" ||
      host.endsWith(".ashbyhq.com")
    );
  } catch {
    return false;
  }
}

/** Union fields from repeated scans of the same frame (lazy iframe / progressive form render). */
export function mergeFrameScanSnapshot(
  previous: FrameScanResult | undefined,
  next: FrameScanResult
): FrameScanResult {
  if (!previous) return next;

  const seen = new Set<string>();
  const fields: DetectedField[] = [];
  for (const field of [...previous.fields, ...next.fields]) {
    const key = `${next.frameId}:${field.selectorHint}:${field.normalizedLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({ ...field, frameId: next.frameId });
  }

  return {
    ...next,
    fields: dedupeDetectedFields(fields),
    jobInfo: mergeJobInfo(next.jobInfo, previous.jobInfo),
    context: {
      ...next.context,
      jobPostingText: pickLongerText(next.context.jobPostingText, previous.context.jobPostingText),
      bodyText: pickLongerText(next.context.bodyText, previous.context.bodyText)
    },
    jobInfoExtracted: next.jobInfoExtracted || previous.jobInfoExtracted,
    jobInfoFromListing: next.jobInfoFromListing || previous.jobInfoFromListing
  };
}

function pickPrimaryFrame(results: FrameScanResult[]): FrameScanResult {
  return [...results].sort((left, right) => {
    const fieldDelta = right.fields.length - left.fields.length;
    if (fieldDelta !== 0) return fieldDelta;
    const jobTextDelta =
      (right.context.jobPostingText?.length ?? 0) - (left.context.jobPostingText?.length ?? 0);
    if (jobTextDelta !== 0) return jobTextDelta;
    return left.frameId === 0 ? -1 : right.frameId === 0 ? 1 : 0;
  })[0];
}

function pickAdapterResult(results: FrameScanResult[]): FrameScanResult {
  const greenhouse = results.find((result) => result.platform === "greenhouse" && result.fields.length > 0);
  if (greenhouse) return greenhouse;
  return pickPrimaryFrame(results);
}

function mergeFields(results: FrameScanResult[]): DetectedField[] {
  const merged: DetectedField[] = [];

  for (const result of results) {
    for (const field of result.fields) {
      merged.push({ ...field, frameId: result.frameId });
    }
  }

  return dedupeDetectedFields(merged);
}

function mergePageType(results: FrameScanResult[], fieldCount: number): PageType {
  if (fieldCount > 0) return "job_application_form";
  const withType = results.find((result) => result.pageType !== "unknown_page");
  return withType?.pageType ?? "unknown_page";
}

function embeddedAtsHint(contextUrl: string, bodyText: string): string | undefined {
  const haystack = `${contextUrl} ${bodyText.slice(0, 5000)}`.toLowerCase();
  if (/greenhouse\.io|gh_jid|grnhse_app|grnhse/i.test(haystack)) {
    return " A Greenhouse application form may be embedded — click Apply, wait for the form to load, then rescan.";
  }
  if (/lever\.co|lever-app/i.test(haystack)) {
    return " A Lever application form may be embedded — open the form, then rescan.";
  }
  if (/ashbyhq\.com|ashby/i.test(haystack)) {
    return " An Ashby application form may be embedded — open the form, then rescan.";
  }
  return undefined;
}

export function mergeFrameScanResults(results: FrameScanResult[], tabUrl: string): ScanResult {
  if (!results.length) {
    throw new Error(
      "ApplyOS could not scan this page. If the application form is inside an embedded frame, wait for it to load and try again."
    );
  }

  const topFrame = results.find((result) => result.frameId === 0) ?? results[0];
  const adapterResult = pickAdapterResult(results);
  const fields = mergeFields(results);

  let jobInfo = topFrame.jobInfo;
  for (const result of results) {
    jobInfo = mergeJobInfo(result.jobInfo, jobInfo);
  }

  const hasJobOnPage = results.some((result) => (result.context.jobPostingText?.trim().length ?? 0) >= 200);
  const jobInfoFromListing = results.some((result) => result.jobInfoFromListing);
  const embeddedForm = results.length > 1 && fields.length > 0 && adapterResult.frameId !== 0;

  const listingNote = jobInfoFromListing
    ? " Stored job requirements were merged for this role."
    : hasJobOnPage && fields.length > 0
      ? " Job description was read from this page."
      : "";

  let message = adapterResult.message;
  if (embeddedForm) {
    message = `Application form detected in an embedded ATS frame (${fields.length} fields).${listingNote}`;
  } else if (fields.length === 0) {
    const embedHint = embeddedAtsHint(tabUrl, topFrame.context.bodyText);
    message =
      message ??
      `No application fields were found.${embedHint ?? ""}${jobInfoFromListing ? listingNote : " Open the application form, then scan again."}`;
  }

  return {
    context: {
      ...topFrame.context,
      url: tabUrl,
      jobPostingText: results
        .map((result) => result.context.jobPostingText)
        .sort((left, right) => right.length - left.length)[0]
    },
    pageType: mergePageType(results, fields.length),
    platform: adapterResult.platform,
    adapterName: adapterResult.adapterName,
    jobInfo,
    fields,
    message,
    watching: results.some((result) => result.watching),
    jobInfoFromListing,
    jobInfoExtracted: results.some((result) => result.jobInfoExtracted)
  };
}
