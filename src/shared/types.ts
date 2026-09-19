// Shared types used across the content script, background worker, and side panel.

/** A single visible example/test case scraped from the problem page. */
export interface TestCase {
  /** Human label, e.g. "Example 1". */
  name: string;
  /**
   * Raw scraped input text as shown on the page (e.g. "nums = [2,7,11,15], target = 9").
   * The side panel parses this into positional args for the user's function.
   */
  input: string;
  /** Raw expected-output text as shown on the page, if any (e.g. "[0,1]"). */
  expected?: string;
}

/** Payload the adapter returns when the side panel asks for the current problem. */
export interface ScrapeResult {
  site: "neetcode" | "leetcode" | "unknown";
  url: string;
  /** The user's current editor contents (Python source). */
  code: string;
  /** Detected top-level solution function/method signature, for wrapping. */
  functionSignature: string;
  testCases: TestCase[];
  /**
   * Non-fatal diagnostics surfaced to the UI so the user understands when a
   * selector-based scrape fell back to a less reliable path (or failed).
   */
  warnings: string[];
}

// ---- Messaging contract ---------------------------------------------------

export type PanelToContentMessage = { type: "SCRAPE_REQUEST" };

export type ContentToPanelMessage =
  | { type: "SCRAPE_RESULT"; result: ScrapeResult }
  | { type: "SCRAPE_ERROR"; error: string };

/** Runtime message routed through the background worker. */
export type RuntimeMessage =
  | { channel: "panel->content"; tabId: number; payload: PanelToContentMessage }
  | { channel: "content->panel"; payload: ContentToPanelMessage };
