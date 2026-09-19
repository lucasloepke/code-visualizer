// Primary target: neetcode.io/practice problem pages.
//
// IMPORTANT (empirical DOM caveat): NeetCode ships its own in-browser editor.
// At time of writing it embeds the Monaco editor (window.monaco), so the
// preferred path reads the model directly via the page bridge. The DOM/text
// fallbacks below are best-effort and the exact container selectors for the
// example test cases MUST be confirmed against a live problem page -- if they
// don't match, the adapter surfaces a warning rather than silently failing, and
// the side panel lets the user paste code/tests manually.

import type { TestCase } from "../../shared/types";
import type { SiteAdapter } from "./types";
import { requestEditorState } from "../bridge-client";
import { extractSignature, scrapeExamplesFromText } from "../scrape-util";

export class NeetCodeAdapter implements SiteAdapter {
  readonly site = "neetcode" as const;
  private lastWarnings: string[] = [];

  matches(url: string): boolean {
    return /(^|\.)neetcode\.io$/.test(new URL(url).hostname);
  }

  takeWarnings(): string[] {
    const w = this.lastWarnings;
    this.lastWarnings = [];
    return w;
  }

  async getCode(): Promise<string> {
    // 1) Preferred: read Monaco/CodeMirror model via the page bridge.
    const state = await requestEditorState();
    if (state?.code) return state.code;

    // 2) Fallback: reconstruct from rendered Monaco view lines (whitespace may
    //    be imperfect because Monaco virtualizes/renders visible lines only).
    const domCode = this.readMonacoDom();
    if (domCode) {
      return domCode;
    }

    this.lastWarnings.push(
      "Could not read the NeetCode editor automatically. Confirm the editor's " +
        "window globals / DOM on a live problem page, or paste code manually.",
    );
    return "";
  }

  private readMonacoDom(): string {
    const lines = document.querySelectorAll<HTMLElement>(".monaco-editor .view-lines .view-line");
    if (lines.length === 0) return "";
    return Array.from(lines)
      .map((l) => l.textContent?.replace(/\u00a0/g, " ") ?? "")
      .join("\n");
  }

  async getTestCases(): Promise<TestCase[]> {
    // NeetCode renders the problem prose (with Example / Input / Output blocks)
    // in a description pane. We scan common containers for that text.
    const containers = [
      document.querySelector<HTMLElement>('[class*="description"]'),
      document.querySelector<HTMLElement>('[class*="problem"]'),
      document.querySelector<HTMLElement>("article"),
      document.querySelector<HTMLElement>("main"),
      document.body,
    ].filter((el): el is HTMLElement => !!el);

    for (const c of containers) {
      const cases = scrapeExamplesFromText(c);
      if (cases.length > 0) return cases;
    }
    this.lastWarnings.push(
      "No visible example test cases found on the NeetCode page. Confirm the " +
        "description container selector, or add test inputs manually.",
    );
    return [];
  }

  async getFunctionSignature(): Promise<string> {
    return extractSignature(await this.getCode());
  }
}
