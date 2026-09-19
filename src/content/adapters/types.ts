import type { TestCase } from "../../shared/types";

/**
 * Swappable per-site scraping interface. The content script selects an adapter
 * via matches(window.location.href). Add a new site by implementing this and
 * registering it in the adapters list -- nothing else in the pipeline changes.
 */
export interface SiteAdapter {
  readonly site: "neetcode" | "leetcode";
  /** Does this adapter handle the given URL? */
  matches(url: string): boolean;
  /** Current editor contents (the user's Python source). */
  getCode(): Promise<string>;
  /** Visible example/test-case inputs shown on the problem page. */
  getTestCases(): Promise<TestCase[]>;
  /** Detected solution function/method signature, used for wrapping. */
  getFunctionSignature(): Promise<string>;
}

/** Shared warnings collector so adapters can surface non-fatal scrape issues. */
export class Warnings {
  private list: string[] = [];
  add(msg: string) {
    this.list.push(msg);
  }
  all(): string[] {
    return [...this.list];
  }
}
