import type { CvSource } from "../shared/types";
import { enrichCvSourceFromCatalog } from "../matching/recommendCv";
import { restoreImportedFileName } from "../shared/cvCatalog";

/** Backfill catalog metadata on imported CVs. Does not seed raw CV text from the repo. */
export async function ensureCvLibrarySeeded(
  listAll: () => Promise<CvSource[]>,
  putOne: (source: CvSource) => Promise<void>
): Promise<void> {
  const existing = await listAll();
  for (const source of existing) {
    const fileName = restoreImportedFileName(source.fileName);
    const enriched = enrichCvSourceFromCatalog(fileName);
    const needsFileNameFix = fileName !== source.fileName;
    const needsMetadata = !source.summary || !source.positioningLabel;
    if (!needsFileNameFix && !needsMetadata) continue;
    if (!needsFileNameFix && !enriched.summary && !enriched.positioningLabel) continue;

    await putOne({
      ...source,
      ...enriched,
      fileName
    });
  }
}
