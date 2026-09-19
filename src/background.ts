// Minimal MV3 service worker. Opens the side panel on toolbar click, scoped to
// the tab that was clicked. The panel (an extension page with chrome.tabs
// access) messages the content script directly, so no routing is needed here.

const PANEL_PATH = "index.html";

// Turn the panel off everywhere, so only tabs we explicitly enable show it.
async function disableGlobally() {
  try {
    await chrome.sidePanel.setOptions({ enabled: false });
  } catch (err) {
    console.error("[leetvision] setOptions(global) failed", err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Must be false, or action.onClicked never fires and the panel goes global.
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