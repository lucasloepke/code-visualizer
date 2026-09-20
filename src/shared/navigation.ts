/** Shared helpers for detecting NeetCode / LeetCode problem pages. */

export function isCodingHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "neetcode.io" || host.endsWith(".neetcode.io")
      || host === "leetcode.com" || host.endsWith(".leetcode.com");
  } catch {
    return false;
  }
}

/** True when the URL is a concrete problem page (not profile/home/lists alone). */
export function isProblemUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!isCodingHost(url)) return false;
    const path = u.pathname;
    // NeetCode: /problems/<slug>/... or /practice/<slug>
    if (u.hostname.includes("neetcode")) {
      return /^\/problems\/[^/]+/i.test(path) || /^\/practice\/[^/]+/i.test(path);
    }
    // LeetCode: /problems/<slug>/...
    return /^\/problems\/[^/]+/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Stable identity for a problem, ignoring query strings and trailing segments
 * like `/question` so next/prev arrows still count as the same problem key
 * only when the slug matches.
 */
export function problemKey(url: string): string | null {
  if (!isProblemUrl(url)) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // problems/<slug> or practice/<slug>
    const i = parts.findIndex((p) => p === "problems" || p === "practice");
    if (i < 0 || !parts[i + 1]) return null;
    return `${u.hostname}/${parts[i]}/${parts[i + 1]}`.toLowerCase();
  } catch {
    return null;
  }
}
