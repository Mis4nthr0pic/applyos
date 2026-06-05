import { createKnownAdapter } from "./helpers";

export const gemAdapter = createKnownAdapter({
  id: "gem",
  name: "Gem Job Board",
  hosts: ["jobs.gem.com"],
  priority: 110
});
