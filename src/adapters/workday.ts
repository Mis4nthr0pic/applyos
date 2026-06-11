import { createKnownAdapter } from "./helpers";
export const workdayAdapter = createKnownAdapter({
  id: "workday",
  name: "Workday",
  hosts: ["myworkdayjobs.com", "myworkdaysite.com"]
});
