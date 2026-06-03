import type { JobInfo, JobListingCache, PageType } from "../shared/types";
import { isThinJobInfo, mergeJobInfo } from "../adapters/listingResolver";
import { db } from "./index";

export async function saveJobListingCache(entry: {
  listingKey: string;
  listingUrl: string;
  extractedFromUrl: string;
  jobInfo: JobInfo;
  platform: string;
  pageType: PageType;
}): Promise<JobListingCache> {
  const record: JobListingCache = {
    id: entry.listingKey,
    listingUrl: entry.listingUrl,
    extractedFromUrl: entry.extractedFromUrl,
    jobInfo: entry.jobInfo,
    platform: entry.platform,
    pageType: entry.pageType,
    extractedAt: new Date().toISOString()
  };
  await db.jobListingCache.put(record);
  return record;
}

export async function loadJobListingCache(listingKey: string): Promise<JobListingCache | undefined> {
  return db.jobListingCache.get(listingKey);
}

export async function mergeWithStoredJobInfo(
  listingKey: string,
  jobInfo: JobInfo
): Promise<{ jobInfo: JobInfo; fromStored: boolean }> {
  const stored = await loadJobListingCache(listingKey);
  if (!stored || isThinJobInfo(stored.jobInfo)) {
    return { jobInfo, fromStored: false };
  }
  return {
    jobInfo: mergeJobInfo(stored.jobInfo, {
      ...jobInfo,
      listingSourceUrl: stored.listingUrl
    }),
    fromStored: true
  };
}
