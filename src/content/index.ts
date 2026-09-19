// Content script entry. Selects a SiteAdapter for the current URL and answers
// SCRAPE_REQUEST messages from the side panel with a ScrapeResult.

import type { PanelToContentMessage, ScrapeResult } from "../shared/types";
import type { SiteAdapter } from "./adapters/types";
import { NeetCodeAdapter } from "./adapters/neetcode";
import { LeetCodeAdapter } from "./adapters/leetcode";
import { extractSignature } from "./scrape-util";

// NeetCode first (primary target), then LeetCode.
const adapters: (SiteAdapter & { takeWarnings(): string[] })[] = [
  new NeetCodeAdapter(),
  new LeetCodeAdapter(),
];

function pickAdapter(url: string) {
  return adapters.find((a) => {
    try {
      return a.matches(url);
    } catch {
      return false;
    }
  });
}

async function scrape(): Promise<ScrapeResult> {
  const url = window.location.href;
  const adapter = pickAdapter(url);
  if (!adapter) {
    return {
      site: "unknown",
      url,
      code: "",
      functionSignature: "",
      testCases: [],
      warnings: ["No site adapter matched this page."],
    };
  }
  const code = await adapter.getCode();
  const testCases = await adapter.getTestCases();
  const functionSignature = extractSignature(code);
  return {
    site: adapter.site,
    url,
    code,
    functionSignature,
    testCases,
    warnings: adapter.takeWarnings(),
  };
}

chrome.runtime.onMessage.addListener(
  (message: PanelToContentMessage, _sender, sendResponse) => {
    if (message?.type === "SCRAPE_REQUEST") {
      scrape()
        .then((result) => sendResponse({ type: "SCRAPE_RESULT", result }))
        .catch((err) => sendResponse({ type: "SCRAPE_ERROR", error: String(err) }));
      return true; // async response
    }
    return undefined;
  },
);
