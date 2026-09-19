// Side-panel side: ask the active tab's content script to scrape the problem.

import type { ContentToPanelMessage, ScrapeResult } from "../shared/types";

export async function scrapeActiveTab(): Promise<ScrapeResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab to scrape.");
  if (!/^https:\/\/(neetcode\.io|leetcode\.com)/.test(tab.url ?? "")) {
    throw new Error(
      "Open a neetcode.io/practice (or leetcode.com) problem in the active tab, then Scrape.",
    );
  }
  let resp: ContentToPanelMessage;
  try {
    resp = (await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_REQUEST" })) as ContentToPanelMessage;
  } catch {
    throw new Error(
      "Content script not reachable. Reload the problem tab after installing the extension.",
    );
  }
  if (!resp) throw new Error("No response from the page.");
  if (resp.type === "SCRAPE_ERROR") throw new Error(resp.error);
  return resp.result;
}
