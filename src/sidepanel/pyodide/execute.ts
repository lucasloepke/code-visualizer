// Runs every test case through the tracer and assembles TraceRun[] for the UI.

import type { TestCase } from "../../shared/types";
import type { TraceRun } from "../../shared/trace";
import { runTrace, type Coercion } from "./runner";
import {
  compareResult,
  inferCoercions,
  parseSignature,
  parseTestInput,
} from "./problem";

export interface ExecuteOptions {
  code: string;
  signature: string;
  testCases: TestCase[];
}

/** Map scraped `index` / `pos` onto the primary linked-list arg (usually `head`). */
function linkedListCycleIndexes(
  coercions: Coercion[],
  names: (string | null)[],
  extras: Record<string, unknown>,
): (number | null)[] {
  const raw = extras.index ?? extras.pos;
  const cycle = typeof raw === "number" && Number.isInteger(raw) ? raw : null;
  const out: (number | null)[] = coercions.map(() => null);
  if (cycle == null || cycle < 0) return out;
  // Prefer the arg named head; else the first linked_list arg.
  let target = names.findIndex((n, i) => n === "head" && coercions[i] === "linked_list");
  if (target < 0) target = coercions.findIndex((c) => c === "linked_list");
  if (target >= 0) out[target] = cycle;
  return out;
}

export async function executeAll({
  code,
  signature,
  testCases,
}: ExecuteOptions): Promise<TraceRun[]> {
  const sig = parseSignature(signature || code);
  const runs: TraceRun[] = [];

  for (const tc of testCases) {
    const { args, names, extras } = parseTestInput(tc.input, sig.params);
    const coercions = inferCoercions(args, names, sig.params, sig.paramTypes);
    const cycleIndexes = linkedListCycleIndexes(coercions, names, extras);
    const raw = await runTrace(code, sig.name, args, coercions, cycleIndexes);
    runs.push({
      testCaseName: tc.name,
      args: raw.args,
      steps: raw.steps,
      result: raw.result ?? undefined,
      error: raw.error ?? undefined,
      truncated: raw.truncated,
      passed: raw.error ? false : compareResult(raw.result, tc.expected),
      stdout: raw.stdout,
      stringParams: raw.stringParams ?? [],
      indexVars: raw.indexVars ?? [],
    });
  }
  return runs;
}
