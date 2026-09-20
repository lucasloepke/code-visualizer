// MV3 service worker. Opens the side panel on toolbar click, and reacts to
// problem-page navigations: refresh on problem→problem, close on leave (default).

import { isCodingHost, isProblemUrl, problemKey } from "./shared/navigation";
import { getKeepPanelOnLeave } from "./shared/settings";
import type { BackgroundToPanelMessage, ContentToBackgroundMessage } from "./shared/types";

const PANEL_PATH = "index.html";

/** Last known URL per tab — used to detect problem switches vs leaving. */
const lastUrlByTab = new Map<number, string>();

async function disableGlobally() {
  try {
    await chrome.sidePanel.setOptions({ enabled: false });
  } catch (err) {
    console.error("[leetvision] setOptions(global) failed", err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err) => console.error("[leetvision] setPanelBehavior failed", err));
  await disableGlobally();
});

chrome.runtime.onStartup.addListener(disableGlobally);

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  chrome.sidePanel
    .setOptions({ tabId: tab.id, path: PANEL_PATH, enabled: true })
    .catch((err) => console.error("[leetvision] setOptions failed", err));
  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch((err) => console.error("[leetvision] open failed", err));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastUrlByTab.delete(tabId);
});

async function closePanelForTab(tabId: number) {
  try {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  } catch (err) {
    console.error("[leetvision] close panel failed", err);
  }
}

function notifyPanelProblemChanged(tabId: number, url: string) {
  const msg: BackgroundToPanelMessage = { type: "PROBLEM_CHANGED", tabId, url };
  chrome.runtime.sendMessage(msg).catch(() => {
    // No side panel listening — that's fine.
  });
}

async function handleUrlChange(tabId: number, url: string) {
  if (!url || !isCodingHost(url)) {
    lastUrlByTab.set(tabId, url ?? "");
    return;
  }

  const prev = lastUrlByTab.get(tabId) ?? "";
  lastUrlByTab.set(tabId, url);
  if (prev === url) return;

  const prevKey = problemKey(prev);
  const nextKey = problemKey(url);
  const wasProblem = isProblemUrl(prev);
  const isProblem = isProblemUrl(url);

  // Problem A → Problem B: auto-refresh the panel.
  if (prevKey && nextKey && prevKey !== nextKey) {
    notifyPanelProblemChanged(tabId, url);
    return;
  }

  // Left a problem page entirely (profile, home, list index, etc.).
  if (wasProblem && !isProblem) {
    const keep = await getKeepPanelOnLeave();
    if (!keep) await closePanelForTab(tabId);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  const url = changeInfo.url ?? tab.url;
  if (!url) return;
  void handleUrlChange(tabId, url);
});

chrome.runtime.onMessage.addListener((message: ContentToBackgroundMessage, sender) => {
  if (message?.type !== "TAB_URL_CHANGED") return;
  const tabId = sender.tab?.id;
  if (tabId == null || !message.url) return;
  void handleUrlChange(tabId, message.url);
});
