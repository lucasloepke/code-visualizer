import type { SerializedValue, TraceStep } from "../../shared/trace";

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

export interface NamedTree {
  name: string;
  root: Extract<SerializedValue, { kind: "tree" }>["root"];
}

const POINTER_NAME = /^(i|j|k|l|r|lo|hi|mid|p|q|left|right|start|end|slow|fast|idx|index|lp|rp|a|b)$/;

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
  }
}

/** Integer-valued locals that look like index pointers. */
function integerPointers(step: TraceStep): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = [];
  for (const [name, v] of Object.entries(step.locals)) {
    if (v.kind === "primitive" && typeof v.value === "number" && Number.isInteger(v.value)) {
      if (POINTER_NAME.test(name)) out.push({ name, value: v.value });
    }
  }
  return out;
}

/** Node-reference locals (linked list / tree nodes) by their serialized id. */
function nodePointers(step: TraceStep): { name: string; id: number }[] {
  const out: { name: string; id: number }[] = [];
  for (const [name, v] of Object.entries(step.locals)) {
    if (v.kind === "linked_list" && v.nodes.length > 0) {
      out.push({ name, id: v.nodes[0].id });
    }
  }
  return out;
}

export function extractArrays(step: TraceStep): NamedArray[] {
  const ptrs = integerPointers(step);
  const arrays: NamedArray[] = [];
  for (const [name, v] of Object.entries(step.locals)) {
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
  for (const [name, v] of Object.entries(step.locals)) {
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
  for (const [name, v] of Object.entries(step.locals)) {
    if (v.kind === "tree" && v.root) trees.push({ name, root: v.root });
  }
  return trees;
}
