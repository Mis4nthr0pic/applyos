/** Hosts that use React-controlled application forms where DOM value ≠ submitted value. */
export function isReactControlledFormHost(platform?: string, hostname?: string): boolean {
  const host = (
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : "")
  ).toLowerCase();
  if (/ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|workday\.com|jobs\.gem\.com/i.test(host)) {
    return true;
  }
  return platform === "ashby" || platform === "greenhouse" || platform === "lever" || platform === "workday" || platform === "gem";
}
