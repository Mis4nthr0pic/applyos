import { selectAdapter } from "./index";
import { enrichJobInfo } from "./enrichJobInfo";
import { jobListingCacheKey, resolveListingUrl } from "./listingResolver";
import type { JobInfo, PageContext, PageType } from "../shared/types";

export interface ExtractedJobPayload {
  context: PageContext;
  pageType: PageType;
  platform: string;
  adapterName: string;
  jobInfo: JobInfo;
  listingKey: string;
  listingUrl: string;
  jobInfoFromListing: boolean;
}

export async function extractJobFromPage(context: PageContext): Promise<ExtractedJobPayload> {
  const adapter = selectAdapter(context);
  const pageType = adapter.classify(context);
  let jobInfo = await adapter.extractJobInfo(context);
  const enriched = await enrichJobInfo(context, pageType, adapter.id, jobInfo);
  jobInfo = enriched.jobInfo;

  const listingUrl = resolveListingUrl(context) ?? context.url;
  const listingKey = jobListingCacheKey(listingUrl);

  return {
    context,
    pageType,
    platform: adapter.id,
    adapterName: adapter.name,
    jobInfo: {
      ...jobInfo,
      listingSourceUrl: enriched.fromListing ? listingUrl : jobInfo.listingSourceUrl
    },
    listingKey,
    listingUrl,
    jobInfoFromListing: enriched.fromListing
  };
}
