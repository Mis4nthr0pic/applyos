import type { CvSource } from "../shared/types";
import { enrichCvSourceFromCatalog } from "../matching/recommendCv";

/** Backfill catalog metadata on imported CVs. Does not seed raw CV text from the repo. */
export async function ensureCvLibrarySeeded(
  listAll: () => Promise<CvSource[]>,
  putOne: (source: CvSource) => Promise<void>
): Promise<void> {
  const existing = await listAll();
  for (const source of existing) {
    if (source.summary && source.positioningLabel) continue;
    const enriched = enrichCvSourceFromCatalog(source.fileName);
    if (!enriched.summary && !enriched.positioningLabel) continue;
    await putOne({
      ...source,
      ...enriched,
      fileName: enriched.fileName || source.fileName
    });
  }
}
