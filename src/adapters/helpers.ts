import type { SiteAdapter } from "./types";
import type { PageContext } from "../shared/types";
import { classifyPage } from "./classifier";
import { extractDetectedFields } from "../content/fieldDetection";
import { extractGenericJobInfo } from "./generic";

export function createKnownAdapter(config: {
  id: string;
  name: string;
  hosts: string[];
  pathPattern?: RegExp;
  priority?: number;
}): SiteAdapter {
  return {
    id: config.id,
    name: config.name,
    priority: config.priority ?? 100,
    matches(context: PageContext) {
      const hostMatch = config.hosts.some(
        (host) => context.hostname === host || context.hostname.endsWith(`.${host}`)
      );
      return hostMatch && (!config.pathPattern || config.pathPattern.test(context.pathname));
    },
    classify: classifyPage,
    async extractJobInfo(context) {
      return extractGenericJobInfo(context, config.id);
    },
    async extractFields() {
      return extractDetectedFields(config.id);
    }
  };
}
