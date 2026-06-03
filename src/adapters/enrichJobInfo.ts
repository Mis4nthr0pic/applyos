import type { JobInfo, PageContext } from "../shared/types";
import { extractGenericJobInfo } from "./generic";
import {
  isThinJobInfo,
  jobListingCacheKey,
  mergeJobInfo,
  resolveListingUrl
} from "./listingResolver";
import { buildPageContextFromHtml } from "../content/pageContext";
import { hasJobPostingContent } from "../content/jobPostingText";

const CACHE_PREFIX = "applyos:job-listing:";

export async function enrichJobInfo(
  context: PageContext,
  pageType: string,
  platform: string,
  jobInfo: JobInfo
): Promise<{ jobInfo: JobInfo; fromListing: boolean }> {
  const listingUrl = resolveListingUrl(context);
  const onApplicationPage =
    pageType === "job_application_form" || Boolean(listingUrl && listingUrl !== context.url);

  cacheJobListing(jobInfo);

  if (!onApplicationPage && !isThinJobInfo(jobInfo)) {
    return { jobInfo, fromListing: false };
  }

  const cached = readCachedJobListing(context.url);
  if (cached && !isThinJobInfo(cached)) {
    return {
      jobInfo: mergeJobInfo(cached, { ...jobInfo, listingSourceUrl: cached.sourceUrl }),
      fromListing: true
    };
  }

  if (!listingUrl || listingUrl === context.url) {
    const combinedListingAndForm = onApplicationPage && hasJobPostingContent(context);
    if (isThinJobInfo(jobInfo) || combinedListingAndForm) {
      return { jobInfo: reparseCurrentPage(context, platform, jobInfo), fromListing: false };
    }
    return { jobInfo, fromListing: false };
  }

  try {
    const response = await fetch(listingUrl, { credentials: "include" });
    if (!response.ok) throw new Error(`Listing fetch failed (${response.status})`);
    const html = await response.text();
    const listingContext = buildPageContextFromHtml(html, listingUrl);
    const listingInfo = extractGenericJobInfo(listingContext, platform);
    const merged = mergeJobInfo(
      { ...listingInfo, listingSourceUrl: listingUrl },
      jobInfo
    );
    cacheJobListing(merged, listingUrl);
    return { jobInfo: merged, fromListing: true };
  } catch {
    const reparsed = reparseCurrentPage(context, platform, jobInfo);
    if (!isThinJobInfo(reparsed)) {
      return { jobInfo: reparsed, fromListing: false };
    }
    return { jobInfo, fromListing: false };
  }
}

function reparseCurrentPage(context: PageContext, platform: string, jobInfo: JobInfo): JobInfo {
  const reparsed = extractGenericJobInfo(context, platform);
  return mergeJobInfo(reparsed, jobInfo);
}

function cacheJobListing(jobInfo: JobInfo, url?: string): void {
  if (isThinJobInfo(jobInfo)) return;
  try {
    const key = `${CACHE_PREFIX}${jobListingCacheKey(url ?? jobInfo.sourceUrl)}`;
    sessionStorage.setItem(key, JSON.stringify(jobInfo));
  } catch {
    // sessionStorage may be unavailable.
  }
}

function readCachedJobListing(url: string): JobInfo | undefined {
  try {
    const key = `${CACHE_PREFIX}${jobListingCacheKey(url)}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as JobInfo;
  } catch {
    return undefined;
  }
}
