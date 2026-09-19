// Types describing the trace produced by the Python tracer (sys.settrace) and
// consumed by the Framer Motion playback UI. The Python side emits exactly this
// shape as ONE JSON array -- no streaming, no callbacks.

/**
 * A serialized Python value. The Python serializer only produces the shapes the
 * demo problems need: primitives, arrays, singly-linked lists, and binary trees.
 * Anything else falls back to a repr string.
 */
export type SerializedValue =
  | { kind: "primitive"; value: number | boolean | null }
  | { kind: "string"; value: string; length: number; chars?: string[]; truncated?: boolean }
  | { kind: "array"; items: SerializedValue[] }
  | { kind: "map"; entries: MapEntry[] }
  | { kind: "set"; items: SerializedValue[] }
  | { kind: "linked_list"; nodes: LinkedListNode[] }
  | { kind: "tree"; root: TreeNode | null }
  | { kind: "repr"; repr: string; type: string };

export interface MapEntry {
  key: SerializedValue;
  value: SerializedValue;
}

export interface LinkedListNode {
  /** Stable identity (Python id()) so Framer Motion can key/animate nodes. */
  id: number;
  value: SerializedValue;
}

export interface TreeNode {
  id: number;
  value: SerializedValue;
  left: TreeNode | null;
  right: TreeNode | null;
}

/** A single traced execution step (one sys.settrace 'line' event). */
export interface TraceStep {
  /** Monotonic step index in the run. */
  step: number;
  /** 1-based line number in the user's source that is about to execute. */
  line: number;
  /** Call-stack depth (0 = entry frame), so the UI can show recursion. */
  depth: number;
  /** Name of the function whose frame this line belongs to. */
  func: string;
  /** Local variables at this step, deep-copied to avoid aliasing across steps. */
  locals: Record<string, SerializedValue>;
  /** 'line' for normal steps, 'return' for a return, 'exception' if it threw. */
  event: "line" | "return" | "exception" | "call";
  /** Present only when event === 'return'. */
  returnValue?: SerializedValue;
}

export interface TraceError {
  type: string;
  message: string;
  line: number | null;
}

/** The full result of tracing one test case. */
export interface TraceRun {
  testCaseName: string;
  /** The positional args passed to the user's function, serialized. */
  args: SerializedValue[];
  steps: TraceStep[];
  /** Final returned value (undefined if it raised or returned None implicitly). */
  result?: SerializedValue;
  /** Set if execution raised. */
  error?: TraceError;
  /** True if the step cap was hit (suspected infinite loop). */
  truncated: boolean;
  /** Pass/fail vs the scraped expected output, when comparable. */
  passed: boolean | null;
  /** Any stdout produced by print() during the run. */
  stdout: string;
  /** Names of parameters that arrived as strings — candidates for cell rendering. */
  stringParams: string[];
  /** Locals used to subscript a string param (found via AST), i.e. real indices. */
  indexVars: string[];
}

export const MAX_TRACE_STEPS = 500;
