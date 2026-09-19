// Secondary target: leetcode.com problem pages. Same interface as NeetCode;
// implemented after NeetCode works end-to-end. LeetCode uses Monaco, so the
// page-bridge model read is the primary path here too.

import type { TestCase } from "../../shared/types";
import type { SiteAdapter } from "./types";
import { requestEditorState } from "../bridge-client";
import { extractSignature, scrapeExamplesFromText } from "../scrape-util";

export class LeetCodeAdapter implements SiteAdapter {
  readonly site = "leetcode" as const;
  private lastWarnings: string[] = [];

  matches(url: string): boolean {
    return /(^|\.)leetcode\.com$/.test(new URL(url).hostname);
  }

  takeWarnings(): string[] {
    const w = this.lastWarnings;
    this.lastWarnings = [];
    return w;
  }

  async getCode(): Promise<string> {
    const state = await requestEditorState();
    if (state?.code) return state.code;
    const lines = document.querySelectorAll<HTMLElement>(".monaco-editor .view-lines .view-line");
    if (lines.length > 0) {
      this.lastWarnings.push("Read LeetCode code from rendered editor lines; indentation may be approximate.");
      return Array.from(lines).map((l) => l.textContent?.replace(/\u00a0/g, " ") ?? "").join("\n");
    }
    this.lastWarnings.push("Could not read the LeetCode editor automatically; paste code manually.");
    return "";
  }

  async getTestCases(): Promise<TestCase[]> {
    const containers = [
      document.querySelector<HTMLElement>('[data-track-load="description_content"]'),
      document.querySelector<HTMLElement>('[class*="description"]'),
      document.querySelector<HTMLElement>("main"),
      document.body,
    ].filter((el): el is HTMLElement => !!el);
    for (const c of containers) {
      const cases = scrapeExamplesFromText(c);
      if (cases.length > 0) return cases;
    }
    this.lastWarnings.push("No visible example test cases found on the LeetCode page; add test inputs manually.");
    return [];
  }

  async getFunctionSignature(): Promise<string> {
    return extractSignature(await this.getCode());
  }
}
