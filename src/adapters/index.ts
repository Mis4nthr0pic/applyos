import type { PageContext } from "../shared/types";
import type { SiteAdapter } from "./types";
import { ashbyAdapter } from "./ashby";
import { bambooHrAdapter } from "./bamboohr";
import { customCareersAdapter } from "./customCareers";
import { gemAdapter } from "./gem";
import { genericAdapter } from "./generic";
import { greenhouseAdapter } from "./greenhouse";
import { icimsAdapter } from "./icims";
import { linkedinAdapter } from "./linkedin";
import { leverAdapter } from "./lever";
import { recruiteeAdapter } from "./recruitee";
import { smartRecruitersAdapter } from "./smartrecruiters";
import { teamtailorAdapter } from "./teamtailor";
import { workableAdapter } from "./workable";
import { workdayAdapter } from "./workday";

export const adapters: SiteAdapter[] = [
  ashbyAdapter,
  gemAdapter,
  greenhouseAdapter,
  leverAdapter,
  linkedinAdapter,
  workableAdapter,
  workdayAdapter,
  smartRecruitersAdapter,
  bambooHrAdapter,
  recruiteeAdapter,
  teamtailorAdapter,
  icimsAdapter,
  customCareersAdapter,
  genericAdapter
];

export function selectAdapter(context: PageContext): SiteAdapter {
  return adapters
    .filter((adapter) => adapter.matches(context))
    .sort((a, b) => b.priority - a.priority)[0] ?? genericAdapter;
}
