// Turns scraped text (function signature + example inputs/outputs) into the
// positional args + structure coercions the Python tracer expects, and compares
// a run's result against the expected output.

import type { SerializedValue } from "../../shared/trace";
import type { Coercion } from "./runner";

export interface ParsedSignature {
  name: string | null;
  params: string[];
}

/** Extract the function/method name and parameter names from a signature string. */
export function parseSignature(sig: string): ParsedSignature {
  if (!sig) return { name: null, params: [] };
  const m = sig.match(/(?:def\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)/);
  if (!m) return { name: null, params: [] };
  const name = m[1];
  const params = m[2]
    .split(",")
    .map((p) => p.trim())
    // strip type annotations and defaults, drop *, **
    .map((p) => p.replace(/[:=].*$/, "").replace(/^\*+/, "").trim())
    .filter((p) => p && p !== "self" && p !== "cls");
  return { name, params };
}

/** Split a string on a delimiter, ignoring delimiters inside brackets/quotes. */
function splitTopLevel(str: string, delim: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "[" || c === "{" || c === "(") depth++;
    if (c === "]" || c === "}" || c === ")") depth--;
    if (c === delim && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

/** Lenient parse of a single Python/JSON-ish literal into a JS value. */
export function parseValue(tokenRaw: string): unknown {
  const token = tokenRaw.trim();
  if (token === "") return null;
  // Normalize Python literals to JSON.
  const normalized = token
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/'/g, '"');
  try {
    return JSON.parse(normalized);
  } catch {
    // Fall back to raw string (e.g. an unquoted word) or a number.
    const num = Number(token);
    if (!Number.isNaN(num) && token !== "") return num;
    return token.replace(/^["']|["']$/g, "");
  }
}

export interface ParsedTestInput {
  args: unknown[];
  /** Argument names when the input used name = value form; parallel to args. */
  names: (string | null)[];
}

/**
 * Parse a scraped example input into positional args.
 * Handles both "nums = [..], target = 9" and newline/positional forms.
 */
export function parseTestInput(input: string, params: string[]): ParsedTestInput {
  const trimmed = input.trim();
  // name = value form?
  const hasAssignments = /(^|,|\n)\s*[A-Za-z_]\w*\s*=/.test(trimmed);
  if (hasAssignments) {
    const parts = splitTopLevel(trimmed.replace(/\n/g, ","), ",");
    const byName = new Map<string, unknown>();
    const order: string[] = [];
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      const val = parseValue(part.slice(eq + 1));
      byName.set(key, val);
      order.push(key);
    }
    // Order args by the declared params when available, else insertion order.
    const orderedKeys = params.length ? params.filter((p) => byName.has(p)) : order;
    // Include any leftover assignments not matched to params.
    for (const k of order) if (!orderedKeys.includes(k)) orderedKeys.push(k);
    return {
      args: orderedKeys.map((k) => byName.get(k)),
      names: orderedKeys,
    };
  }
  // Positional: one value per line, else a single value.
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const tokens = lines.length > 1 ? lines : splitTopLevel(trimmed, ",");
  return {
    args: tokens.map(parseValue),
    names: tokens.map(() => null),
  };
}

const LINKED_LIST_HINTS = /^(head|l1|l2|list1|list2|node|lists?)$/i;
const TREE_HINTS = /^(root|tree|node1|node2)$/i;

/** Infer per-argument structure coercion from param names + value shapes. */
export function inferCoercions(
  args: unknown[],
  names: (string | null)[],
  params: string[],
): Coercion[] {
  return args.map((val, i) => {
    const name = names[i] ?? params[i] ?? "";
    const isArray = Array.isArray(val);
    if (isArray && TREE_HINTS.test(name)) return "tree";
    if (isArray && LINKED_LIST_HINTS.test(name)) return "linked_list";
    if (isArray) return "array";
    return "raw";
  });
}

// ---- Result comparison ----------------------------------------------------

/** Convert a serialized value back to a plain JS value for equality checks. */
export function serializedToPlain(v: SerializedValue | null | undefined): unknown {
  if (v == null) return null;
  switch (v.kind) {
    case "primitive":
      return v.value;
    case "string":
      return v.value;
    case "array":
      return v.items.map(serializedToPlain);
    case "map": {
      const obj: Record<string, unknown> = {};
      for (const e of v.entries) {
        obj[String(serializedToPlain(e.key))] = serializedToPlain(e.value);
      }
      return obj;
    }
    case "set":
      return v.items.map(serializedToPlain);
    case "linked_list":
      return v.nodes.map((n) => serializedToPlain(n.value));
    case "tree":
      return v.root ? treeToPlain(v.root) : null;
    case "repr":
      return v.repr;
  }
}

function treeToPlain(node: NonNullable<Extract<SerializedValue, { kind: "tree" }>["root"]>): unknown {
  return {
    value: serializedToPlain(node.value),
    left: node.left ? treeToPlain(node.left) : null,
    right: node.right ? treeToPlain(node.right) : null,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  // loose scalar compare (e.g. 0 vs "0")
  if (a != null && b != null && typeof a !== "object" && typeof b !== "object") {
    return String(a) === String(b);
  }
  return false;
}

/**
 * Compare a run result to the scraped expected output.
 * Returns null when there's nothing comparable (e.g. no expected, or a tree).
 */
export function compareResult(
  result: SerializedValue | null | undefined,
  expected: string | undefined,
): boolean | null {
  if (result == null || expected == null || expected.trim() === "") return null;
  const expectedVal = parseValue(expected);
  const actual = serializedToPlain(result);
  return deepEqual(actual, expectedVal);
}
