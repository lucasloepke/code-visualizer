// Minimal MV3 service worker. Its only job is to open the side panel when the
// toolbar icon is clicked. The side panel (an extension page with chrome.tabs
// access) messages the content script directly, so no message routing is
// needed here.

chrome.runtime.onInstalled.addListener(() => {
  // Clicking the action icon opens the side panel (kept in sync with the tab).
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("[code-visualizer] setPanelBehavior failed", err));
});

// Also handle the click explicitly for browsers/tabs where behavior isn't set.
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
      /* no-op: panel may already be open */
    });
  }
});
