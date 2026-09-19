// Turns scraped text (function signature + example inputs/outputs) into the
// positional args + structure coercions the Python tracer expects, and compares
// a run's result against the expected output.

import type { SerializedValue } from "../../shared/trace";
import type { Coercion } from "./runner";

export interface ParsedSignature {
  name: string | null;
  params: string[];
  /** Parallel to params — e.g. "Optional[TreeNode]", or null if untyped. */
  paramTypes: (string | null)[];
}

/** Extract the function/method name, parameter names, and type hints. */
export function parseSignature(sig: string): ParsedSignature {
  if (!sig) return { name: null, params: [], paramTypes: [] };
  const m = sig.match(/(?:def\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)/);
  if (!m) return { name: null, params: [], paramTypes: [] };
  const name = m[1];
  const params: string[] = [];
  const paramTypes: (string | null)[] = [];
  for (const raw of splitTopLevel(m[2], ",")) {
    const part = raw.trim();
    if (!part || part.startsWith("*")) continue;
    const noDefault = part.split("=")[0].trim();
    const colon = noDefault.indexOf(":");
    let pname: string;
    let ptype: string | null = null;
    if (colon !== -1) {
      pname = noDefault.slice(0, colon).trim().replace(/^\*+/, "");
      ptype = noDefault.slice(colon + 1).trim() || null;
    } else {
      pname = noDefault.replace(/^\*+/, "").trim();
    }
    if (!pname || pname === "self" || pname === "cls") continue;
    params.push(pname);
    paramTypes.push(ptype);
  }
  return { name, params, paramTypes };
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
const TREE_HINTS = /^(root|tree|node1|node2|p|q)$/i;

/** Infer per-argument structure coercion from type hints, param names, and shapes. */
export function inferCoercions(
  args: unknown[],
  names: (string | null)[],
  params: string[],
  paramTypes: (string | null)[] = [],
): Coercion[] {
  return args.map((val, i) => {
    const name = names[i] ?? params[i] ?? "";
    const typeHint = paramTypes[params.indexOf(name)] ?? paramTypes[i] ?? "";
    const isArray = Array.isArray(val);
    if (isArray && (/TreeNode/i.test(typeHint) || TREE_HINTS.test(name))) return "tree";
    if (isArray && (/ListNode/i.test(typeHint) || LINKED_LIST_HINTS.test(name))) return "linked_list";
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
      // LeetCode/NeetCode print trees as level-order arrays (with trailing
      // nulls omitted), same as the scraped expected output.
      return treeToLevelOrder(v.root);
    case "repr":
      return v.repr;
  }
}

/** BFS level-order array matching LeetCode's tree notation. */
function treeToLevelOrder(
  root: Extract<SerializedValue, { kind: "tree" }>["root"],
): unknown[] {
  if (!root) return [];
  type N = NonNullable<typeof root>;
  const out: unknown[] = [];
  const queue: (N | null)[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node == null) {
      out.push(null);
      continue;
    }
    out.push(serializedToPlain(node.value));
    queue.push(node.left);
    queue.push(node.right);
  }
  while (out.length > 0 && out[out.length - 1] == null) out.pop();
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  // Empty tree returns None; scraped expected is often [].
  if ((a == null && Array.isArray(b) && b.length === 0) || (b == null && Array.isArray(a) && a.length === 0)) {
    return true;
  }
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

function isPrimitive(v: unknown): boolean {
  return v == null || typeof v !== "object";
}

function cmpPrimitive(a: unknown, b: unknown): number {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Canonicalize list-of-lists results where LeetCode/NeetCode allow any order
 * (e.g. Group Anagrams). Flat arrays (linked-list values, paths with order)
 * are left alone so order-sensitive answers still fail when wrong.
 */
function normalizeAnyOrderGroups(v: unknown): unknown {
  if (!Array.isArray(v) || v.length === 0) return v;
  if (!v.every((item) => Array.isArray(item))) return v;

  const groups = v.map((group) => {
    const g = group as unknown[];
    if (g.every(isPrimitive)) return [...g].sort(cmpPrimitive);
    return g;
  });
  return groups.sort((a, b) => {
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
}

/**
 * Compare a run result to the scraped expected output.
 * Returns null when there's nothing comparable (e.g. no expected).
 */
export function compareResult(
  result: SerializedValue | null | undefined,
  expected: string | undefined,
): boolean | null {
  if (result == null || expected == null || expected.trim() === "") return null;
  const expectedVal = parseValue(expected);
  const actual = serializedToPlain(result);
  if (deepEqual(actual, expectedVal)) return true;
  // Group Anagrams etc.: "you may return the output in any order"
  return deepEqual(normalizeAnyOrderGroups(actual), normalizeAnyOrderGroups(expectedVal));
}
