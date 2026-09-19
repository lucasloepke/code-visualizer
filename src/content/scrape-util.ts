// Site-agnostic scraping helpers shared by the adapters.

import type { TestCase } from "../shared/types";

/**
 * Extract the solution signature from Python source. Prefers a method inside a
 * `class Solution`, else the first top-level def. Returns "" if none found.
 */
export function extractSignature(code: string): string {
  if (!code) return "";
  const defRe = /def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*(->\s*[^:]+)?/g;
  const matches = [...code.matchAll(defRe)].map((m) => m[0].trim());
  if (matches.length === 0) return "";
  // Prefer a non-dunder method (skip __init__ etc.).
  const nonDunder = matches.find((m) => !/def\s+__/.test(m));
  return (nonDunder ?? matches[0]).replace(/\s+/g, " ");
}

/**
 * Scrape visible example cases from a description container by scanning its
 * text for Input:/Output: pairs. Deliberately format-driven rather than tied to
 * specific class names, so it survives minor DOM churn on either site.
 */
export function scrapeExamplesFromText(root: HTMLElement | null): TestCase[] {
  if (!root) return [];
  const text = root.innerText || "";
  const cases: TestCase[] = [];
  const re =
    /Input:\s*([\s\S]*?)\s*Output:\s*([\s\S]*?)(?=(?:\n\s*(?:Explanation|Example|Constraints|Input:)\b)|$)/g;
  let m: RegExpExecArray | null;
  let n = 1;
  while ((m = re.exec(text)) !== null) {
    const input = m[1].trim();
    const expected = m[2].trim();
    if (!input) continue;
    cases.push({ name: `Example ${n++}`, input, expected });
  }
  return cases;
}
