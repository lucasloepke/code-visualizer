// Loads the bundled Pyodide runtime (shipped inside the extension package, per
// MV3 CSP which forbids fetching remote scripts) and runs the Python tracer.

import tracerSource from "../../python/tracer.py?raw";
import type { SerializedValue, TraceStep } from "../../shared/trace";

// Raw shape returned by run_trace() in tracer.py (before we massage it into a
// TraceRun in the caller).
export interface RawTraceOutput {
  steps: TraceStep[];
  result: SerializedValue | null;
  error: { type: string; message: string; line: number | null } | null;
  truncated: boolean;
  stdout: string;
  args: SerializedValue[];
  entry: string | null;
}

export type Coercion = "raw" | "array" | "linked_list" | "tree";

type PyodideInterface = {
  runPython: (code: string) => unknown;
  globals: { get: (name: string) => unknown };
};

let pyodidePromise: Promise<PyodideInterface> | null = null;

/**
 * Resolve a packaged asset URL. In the extension this is chrome.runtime.getURL;
 * we guard so the module can also be imported in a plain page for testing.
 */
function assetUrl(path: string): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}

async function initPyodide(): Promise<PyodideInterface> {
  const pyodideModuleUrl = assetUrl("pyodide/pyodide.mjs");
  // Dynamic import from the bundled copy; @vite-ignore keeps Vite from trying
  // to resolve/bundle Pyodide (it fetches its own wasm/stdlib at runtime).
  const mod = await import(/* @vite-ignore */ pyodideModuleUrl);
  const pyodide: PyodideInterface = await mod.loadPyodide({
    indexURL: assetUrl("pyodide/"),
  });
  // Define the tracer once; run_trace becomes callable from JS.
  pyodide.runPython(tracerSource);
  return pyodide;
}

/** Lazily boot Pyodide (idempotent). Subsequent runs reuse the same interpreter. */
export function ensurePyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = initPyodide().catch((err) => {
      pyodidePromise = null; // allow retry after a failed boot
      throw err;
    });
  }
  return pyodidePromise;
}

/**
 * Trace one run of the user's code.
 * @param code       user's Python source
 * @param entry      preferred function/method name (or null to auto-detect)
 * @param args       raw JSON-able positional args (arrays/ints/strings)
 * @param coercions  per-arg structure coercion parallel to args
 */
export async function runTrace(
  code: string,
  entry: string | null,
  args: unknown[],
  coercions: Coercion[],
): Promise<RawTraceOutput> {
  const pyodide = await ensurePyodide();
  const runTraceFn = pyodide.globals.get("run_trace") as (
    code: string,
    entry: string | null,
    argsJson: string,
    coercionsJson: string,
  ) => string;
  const json = runTraceFn(code, entry, JSON.stringify(args), JSON.stringify(coercions));
  return JSON.parse(json) as RawTraceOutput;
}
