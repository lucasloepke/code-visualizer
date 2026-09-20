// Content script entry. Selects a SiteAdapter for the current URL and answers
// SCRAPE_REQUEST messages from the side panel with a ScrapeResult.

import type { ContentToBackgroundMessage, PanelToContentMessage, ScrapeResult } from "../shared/types";
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

// ---- SPA navigation watch (NeetCode next/prev arrows, client-side routing) ----

function notifyUrlChanged() {
  const msg: ContentToBackgroundMessage = {
    type: "TAB_URL_CHANGED",
    url: window.location.href,
  };
  chrome.runtime.sendMessage(msg).catch(() => {
    // Service worker may be asleep / restarting — tabs.onUpdated is a backup.
  });
}

let lastNotified = window.location.href;
function maybeNotify() {
  const href = window.location.href;
  if (href === lastNotified) return;
  lastNotified = href;
  notifyUrlChanged();
}

const origPush = history.pushState.bind(history);
const origReplace = history.replaceState.bind(history);
history.pushState = function (...args: Parameters<History["pushState"]>) {
  origPush(...args);
  maybeNotify();
};
history.replaceState = function (...args: Parameters<History["replaceState"]>) {
  origReplace(...args);
  maybeNotify();
};
window.addEventListener("popstate", maybeNotify);

// Some SPAs mutate the URL slightly after paint; poll lightly as a safety net.
setInterval(maybeNotify, 1000);
notifyUrlChanged();
