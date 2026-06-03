import type { SiteAdapter } from "./types";
import { classifyPage } from "./classifier";
import { extractDetectedFields } from "../content/fieldDetection";
import { extractGenericJobInfo } from "./generic";
import { CAREER_KEYWORDS, normalizeText } from "../content/text";

export const customCareersAdapter: SiteAdapter = {
  id: "custom_careers",
  name: "Custom careers site",
  priority: 10,
  matches(context) {
    const text = normalizeText(
      [context.url, context.title, context.bodyText.slice(0, 15_000), ...context.buttons].join(" ")
    );
    return CAREER_KEYWORDS.filter((keyword) => text.includes(keyword)).length >= 2;
  },
  classify: classifyPage,
  async extractJobInfo(context) {
    return extractGenericJobInfo(context, "custom_careers");
  },
  async extractFields() {
    return extractDetectedFields("custom_careers");
  }
};
