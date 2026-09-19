import type { SerializedValue, TraceStep } from "../../shared/trace";

/** Locals the stage should draw — prefers stack-filled vizLocals when present. */
export function stageLocals(step: TraceStep): Record<string, SerializedValue> {
  if (step.vizLocals && Object.keys(step.vizLocals).length > 0) return step.vizLocals;
  return step.locals;
}

export interface NamedArray {
  name: string;
  items: SerializedValue[];
  /** Pointer variables (name -> index) that currently point into this array. */
  pointers: { name: string; index: number }[];
}

export interface NamedLinkedList {
  name: string;
  nodes: Extract<SerializedValue, { kind: "linked_list" }>["nodes"];
  /** node id -> pointer variable names currently referencing it. */
  pointerByNodeId: Map<number, string[]>;
}
export interface NamedString {
  name: string;
  chars: string[];
  /** Index variables (from AST analysis) that currently point into this string. */
  pointers: { name: string; index: number }[];
  /** Inclusive span between the lowest and highest pointer, or null if <2. */
  window: { start: number; end: number } | null;
}

export interface NamedAux {
  name: string;
  kind: "map" | "set";
  entries: { key: string; value?: string }[];
}

export interface NamedTree {
  name: string;
  root: Extract<SerializedValue, { kind: "tree" }>["root"];
}

export interface NamedMap {
  name: string;
  entries: Extract<SerializedValue, { kind: "map" }>["entries"];
  /** Primitive key currently being looked up / compared, if any. */
  highlightedKey: string | null;
}

const POINTER_NAME = /^(i|j|k|l|r|lo|hi|mid|p|q|left|right|start|end|slow|fast|idx|index|lp|rp|a|b)$/;
/** Locals that often hold the key being probed in a hashmap lookup. */
const LOOKUP_KEY_NAME = /^(complement|comp|key|k|need|needed|diff|target_diff)$/;

export function primitiveText(v: SerializedValue | undefined): string {
  if (!v) return "";
  switch (v.kind) {
    case "primitive":
      return v.value === null ? "None" : String(v.value);
    case "repr":
      return v.repr;
    case "array":
      return `[${v.items.map(primitiveText).join(", ")}]`;
    case "linked_list":
      return v.nodes.map((n) => primitiveText(n.value)).join(" → ");
    case "tree":
      return "<tree>";
    case "string":
      return JSON.stringify(v.value);
    case "map":
      return `{${v.entries
        .map((e) => `${primitiveText(e.key)}: ${primitiveText(e.value)}`)
        .join(", ")}}`;
    case "set":
      return v.items.length === 0 ? "set()" : `{${v.items.map(primitiveText).join(", ")}}`;
  }
}

/** Integer-valued locals that look like index pointers. */
function integerPointers(
  step: TraceStep,
  indexVars?: string[],
): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = [];
  // Prefer AST-derived index vars when available: they distinguish a real index
  // from a counter that happens to be in range (`best` in a sliding window).
  const known = indexVars && indexVars.length > 0 ? new Set(indexVars) : null;
  // Pointers come from the real frame locals (not viz fill-ins).
  for (const [name, v] of Object.entries(step.locals)) {
    if (v.kind === "primitive" && typeof v.value === "number" && Number.isInteger(v.value)) {
      if (known ? known.has(name) : POINTER_NAME.test(name)) {
        out.push({ name, value: v.value });
      }
    }
  }
  return out;
}

/** Node-reference locals (linked list / tree nodes) by their serialized id. */
function nodePointers(step: TraceStep): { name: string; id: number }[] {
  const out: { name: string; id: number }[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind === "linked_list" && v.nodes.length > 0) {
      out.push({ name, id: v.nodes[0].id });
    }
  }
  return out;
}

export function extractArrays(step: TraceStep, indexVars?: string[]): NamedArray[] {
  const ptrs = integerPointers(step, indexVars);
  const arrays: NamedArray[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind === "array") {
      const pointers = ptrs
        .filter((p) => p.value >= 0 && p.value < v.items.length)
        .map((p) => ({ name: p.name, index: p.value }));
      arrays.push({ name, items: v.items, pointers });
    }
  }
  return arrays;
}

export function extractLinkedLists(step: TraceStep): NamedLinkedList[] {
  const nodeRefs = nodePointers(step);
  const lists: NamedLinkedList[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind === "linked_list") {
      const pointerByNodeId = new Map<number, string[]>();
      for (const ref of nodeRefs) {
        if (v.nodes.some((n) => n.id === ref.id)) {
          const arr = pointerByNodeId.get(ref.id) ?? [];
          arr.push(ref.name);
          pointerByNodeId.set(ref.id, arr);
        }
      }
      lists.push({ name, nodes: v.nodes, pointerByNodeId });
    }
  }
  // De-dupe lists that are just tail-suffixes of a longer list (cur/prev etc.)
  // by keeping the longest few; the UI shows the primary structures.
  return lists.sort((a, b) => b.nodes.length - a.nodes.length).slice(0, 3);
}

export function extractTrees(step: TraceStep): NamedTree[] {
  const trees: NamedTree[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind === "tree" && v.root) trees.push({ name, root: v.root });
  }
  return trees;
}

function lookupKeyHighlight(step: TraceStep): string | null {
  for (const [name, v] of Object.entries(step.locals)) {
    if (LOOKUP_KEY_NAME.test(name) && v.kind === "primitive" && v.value != null) {
      return String(v.value);
    }
  }
  return null;
}

export function extractMaps(step: TraceStep): NamedMap[] {
  const highlightedKey = lookupKeyHighlight(step);
  const maps: NamedMap[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind === "map") {
      maps.push({ name, entries: v.entries, highlightedKey });
    }
  }
  return maps;
}

export function extractStrings(step: TraceStep, indexVars?: string[]): NamedString[] {
  const ptrs = integerPointers(step, indexVars);
  const out: NamedString[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind !== "string" || !v.chars || v.chars.length < 2) continue;
    const pointers = ptrs
      .filter((p) => p.value >= 0 && p.value < v.chars!.length)
      .map((p) => ({ name: p.name, index: p.value }));
    const idxs = pointers.map((p) => p.index);
    const window =
      idxs.length >= 2
        ? { start: Math.min(...idxs), end: Math.max(...idxs) }
        : null;
    out.push({ name, chars: v.chars, pointers, window });
  }
  // Longest first: the input string beats incidental slices like `best`/`cand`.
  return out.sort((a, b) => b.chars.length - a.chars.length).slice(0, 2);
}

/** Sets (and only sets) — maps use MapView instead. */
export function extractAux(step: TraceStep): NamedAux[] {
  const out: NamedAux[] = [];
  for (const [name, v] of Object.entries(stageLocals(step))) {
    if (v.kind === "set") {
      out.push({ name, kind: "set", entries: v.items.map((x) => ({ key: primitiveText(x) })) });
    }
  }
  return out;
}
