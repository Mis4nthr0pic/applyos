import type { SiteAdapter } from "./types";
import type { PageContext } from "../shared/types";
import { classifyPage } from "./classifier";
import { extractGenericJobInfo } from "./generic";
import { extractDetectedFields } from "../content/fieldDetection";
import { findLinkedInEasyApplyRoot } from "../content/linkedinForm";

export const linkedinAdapter: SiteAdapter = {
  id: "linkedin",
  name: "LinkedIn Easy Apply",
  priority: 120,
  matches(context: PageContext) {
    return context.hostname === "linkedin.com" || context.hostname.endsWith(".linkedin.com");
  },
  classify: classifyPage,
  async extractJobInfo(context) {
    return extractGenericJobInfo(context, "linkedin");
  },
  async extractFields() {
    const root = findLinkedInEasyApplyRoot();
    if (!root) return [];
    return extractDetectedFields("linkedin", root);
  }
};
