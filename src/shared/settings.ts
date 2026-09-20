/** Persisted user settings (chrome.storage.sync). */

export const KEEP_PANEL_ON_LEAVE_KEY = "keepPanelOnLeave";

/** Default: close the side panel when navigating away from a problem page. */
export const KEEP_PANEL_ON_LEAVE_DEFAULT = false;

export async function getKeepPanelOnLeave(): Promise<boolean> {
  try {
    const got = await chrome.storage.sync.get(KEEP_PANEL_ON_LEAVE_KEY);
    const v = got[KEEP_PANEL_ON_LEAVE_KEY];
    return typeof v === "boolean" ? v : KEEP_PANEL_ON_LEAVE_DEFAULT;
  } catch {
    return KEEP_PANEL_ON_LEAVE_DEFAULT;
  }
}

export async function setKeepPanelOnLeave(value: boolean): Promise<void> {
  await chrome.storage.sync.set({ [KEEP_PANEL_ON_LEAVE_KEY]: value });
}
