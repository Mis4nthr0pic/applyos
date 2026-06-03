import type { DetectedField, JobInfo, PageContext, PageType } from "../shared/types";

export interface SiteAdapter {
  id: string;
  name: string;
  priority: number;
  matches(context: PageContext): boolean;
  classify(context: PageContext): PageType;
  extractJobInfo(context: PageContext): Promise<JobInfo>;
  extractFields(context: PageContext): Promise<DetectedField[]>;
  observeDynamicFields?(onChange: () => void): () => void;
}
