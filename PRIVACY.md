# Privacy Policy — LeetVision

**Last updated:** September 20, 2026

LeetVision (“the Extension”) is a Chrome browser extension that visualizes Python solutions on NeetCode and LeetCode pages. This policy describes what data the Extension handles and how.

## Summary

LeetVision runs **entirely on your device**. It does not operate a backend server, does not sell data, and does not send your code or browsing activity to the developer.

## Data the Extension accesses

When you use LeetVision on a supported problem page (`neetcode.io` or `leetcode.com`), the Extension may read:

- **Editor source code** and related UI text on the active tab (to scrape your solution)
- **Visible example test cases** from the problem description
- **Tab URL** (to detect problem pages and refresh or close the side panel)

Scraped code and test cases are processed **locally** in the Extension’s side panel using a bundled Python-in-WASM runtime (Pyodide). Execution traces stay in memory in the side panel for visualization.

## Data stored on your device

The Extension may store a small preference in Chrome sync storage (for example, whether to keep the side panel open when you leave a problem page). That setting syncs only through your Google account’s normal Chrome sync, if sync is enabled—not through any LeetVision server.

The Extension does **not** persist your solutions, traces, or problem content to remote servers.

## Permissions (why they exist)

| Permission / access | Purpose |
|---|---|
| `sidePanel` | Show the visualization UI beside the page |
| `scripting` / content scripts | Inject helpers needed to read the page editor on supported sites |
| `activeTab` / `tabs` | Talk to the active tab, scrape when you open the panel, react to navigation |
| Host access to `neetcode.io` and `leetcode.com` | Only those sites are scraped |
| `storage` | Save local UI preferences |
| `clipboardRead` | Declared for optional clipboard-related workflows; the Extension does not upload clipboard contents |

## What we do not collect

- No accounts or sign-in for LeetVision
- No analytics, advertising, or tracking SDKs
- No transmission of your code, inputs, outputs, or traces to the developer
- No sale or sharing of personal data with third parties

## Third-party sites

NeetCode and LeetCode are separate services with their own privacy policies. LeetVision only reads content on those pages in your browser to power the visualization; it does not change how those sites handle your account data.

## Children’s privacy

The Extension is not directed at children under 13, and we do not knowingly collect personal information from children.

## Changes

We may update this policy if the Extension’s behavior changes. The “Last updated” date at the top will be revised when that happens. Material changes that affect how data is handled will be reflected in this document in the project repository.

## Contact

Questions about this policy: open an issue at [github.com/lucasloepke/leetvision](https://github.com/lucasloepke/leetvision/issues).
