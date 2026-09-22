# LeetVision — Chrome Extension (MV3)

Dynamically visualize LeetCode / NeetCode executions, step-by-step.

Built for **[SteelHacks XIII (2026)](https://steelhacks.org/)**.

**Chrome Web Store:** [chromewebstore.google.com/detail/leetvision](https://chromewebstore.google.com/detail/leetvision/oncedhloihenbjclhebncagkkigdielf)  
**Repo:** [github.com/lucasloepke/leetvision](https://github.com/lucasloepke/leetvision)

### Team

- [Sean Morisoli](https://github.com/seanmorisoli)
- [Ansel Gunther](https://github.com/asg149)
- [Lucas Loepke](https://github.com/lucasloepke)

Scrapes your Python solution + visible example test cases from a coding-problem
page (NeetCode is the primary target, LeetCode secondary), runs it **entirely
client-side** with a bundled [Pyodide](https://pyodide.org) runtime, traces
execution line-by-line with `sys.settrace`, and renders a step-through animation
(play / pause / scrub) in a Chrome **side panel** docked next to the page.

No backend. No remote code. Everything runs inside the extension's own pages.

## Quick start

```bash
git clone https://github.com/lucasloepke/leetvision.git
cd leetvision
npm install
npm run build      # produces ./dist  (a loadable unpacked extension)
```

Then in Chrome:

1. Go to `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `dist/` folder.
3. Open a `neetcode.io` practice problem (or `leetcode.com/problems/...`).
4. Click the extension icon to open the side panel — it **auto-scrapes** the
   active tab (editor code + visible examples) and runs the visualization.
5. Use the step controls to play / pause / scrub through the trace.

The **↻** button re-scrapes the active tab. Navigating between problems (e.g.
NeetCode’s next/prev arrows) **auto-refreshes** the panel. Leaving a problem
page closes the panel by default — toggle **Don’t close off-problem** in the
**⋮ menu** to keep it open. That menu also holds **Debug mode** (raw code /
test-case editor + manual **Run**) and **built-in examples**.

## Architecture

| Piece | Where | Notes |
|---|---|---|
| Side panel UI | `src/sidepanel/` (React + Framer Motion) | `chrome.sidePanel` — persists when focus returns to the coding tab. |
| Execution engine | Pyodide (Python→WASM) | **Bundled at build time** into `dist/pyodide/`. MV3 CSP blocks fetching remote scripts, so it must ship in the package. `content_security_policy` includes `wasm-unsafe-eval`. |
| Tracer | `src/python/tracer.py` | `sys.settrace` captures line/return/exception events → line no, deep-copied `locals()`, stack depth, event type. Caps at **500 steps** (→ "infinite loop suspected"). Emits the whole run as **one JSON array**. Preloads common LeetCode/NeetCode names (`deque`, `defaultdict`, `Counter`, heapq helpers, etc.) so scraped solutions that omit imports still run. |
| Serializer | `src/python/tracer.py` | Primitives, strings, arrays, dicts/hashmaps, sets, singly-linked lists, and binary trees (cycle-guarded). Everything else falls back to a `repr`. |
| Scraping | `src/content/` | `SiteAdapter` interface + `NeetCodeAdapter` (primary) and `LeetCodeAdapter` (secondary). Picked via `matches(location.href)`. |
| Page bridge | `src/content/page-bridge.ts` | Injected into the page's main world to read the editor's model (Monaco / CodeMirror) off `window`, since content scripts run in an isolated world. |
| Service worker | `src/background.ts` | Opens the side panel on toolbar click. |

### Build system
`npm run build` runs `scripts/build.mjs`, which:
1. builds the React side panel with Vite → `dist/index.html` + `dist/assets/*`,
2. bundles `content.js`, `page-bridge.js`, `background.js` with esbuild (stable names the manifest references),
3. copies `manifest.json`, the Pyodide runtime, and the LeetVision icons.

The Pyodide tracer source is inlined into the panel bundle via a `?raw` import;
Pyodide itself is loaded at runtime with a dynamic `import()` of the **bundled**
`pyodide/pyodide.mjs` (never a CDN).

## Site-adapter pattern

```ts
interface SiteAdapter {
  matches(url: string): boolean;
  getCode(): Promise<string>;
  getTestCases(): Promise<TestCase[]>;
  getFunctionSignature(): Promise<string>;
}
```

Add a site by implementing this and registering it in `src/content/index.ts`.
Nothing downstream (tracer, serializer, UI) changes.

### Scraping notes

Adapters are defensive and layered:

- **Code:** primary path reads the editor model via the page bridge
  (`window.monaco.editor.getModels()[…].getValue()`, with a CodeMirror
  fallback). If that fails it reconstructs from rendered `.monaco-editor
  .view-lines` (indentation may be approximate) and **surfaces a warning**.
- **Test cases:** scraped by scanning the description text for `Input:` / `Output:`
  pairs (format-driven, not class-name-driven, so it survives DOM churn on both
  sites). If nothing is found it **warns** rather than failing silently.
- **Fallback:** turn on **Debug mode** in the ⋮ menu to paste / edit code and
  test cases manually if a selector path misses.

## Test cases → Python objects

Scraped inputs like `nums = [2,7,11,15], target = 9`, `head = [1,2,3,4,5]`, or
`root = [1,2,3,4,5,6,7]` are parsed into positional args. Each arg is coerced
into the right structure based on the parameter name (`head`/`l1`/`lists` →
linked list, `root` → tree, other arrays → array), matching LeetCode/NeetCode
array notation. See `src/sidepanel/pyodide/problem.ts`.

Pass/fail compares the traced return value to scraped expected output:

- **Trees** are compared as level-order arrays (same notation as the examples).
- **List-of-lists** results (e.g. Group Anagrams) allow any order of groups and
  of items within a group.
- Empty tree `None` matches expected `[]`.

## What's implemented

1. ✅ Pyodide bundled + running arbitrary user Python with a `sys.settrace` step array.
2. ✅ `NeetCodeAdapter` / `LeetCodeAdapter` scraping with a page-context bridge.
3. ✅ Auto-scrape + auto-run when the side panel opens; ↻ to re-scrape.
4. ✅ Array / two-pointer, hashmap/dict, string (sliding window), set, linked-list,
   and binary-tree visualizations.
5. ✅ Recursive calls keep the stage filled via stack-aware `vizLocals` (so leaf
   frames like `root is None` still show the outer tree).
6. ✅ LeetCode-style builtin preload (`deque`, `defaultdict`, …) without requiring
   imports in scraped code.

Verified end-to-end in a real browser on problems like Two Sum, Valid Palindrome,
Reverse Linked List, Invert Tree, Group Anagrams, and sliding-window string
problems.

## Out of scope
Non-Python languages · hidden/submit-mode test cases · any backend · multi-run history.

## Dev

```bash
npm run typecheck
python3 scripts/test_tracer.py   # standalone tracer sanity check (no browser)
```
