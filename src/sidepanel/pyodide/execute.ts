// Runs every test case through the tracer and assembles TraceRun[] for the UI.

import type { TestCase } from "../../shared/types";
import type { TraceRun } from "../../shared/trace";
import { runTrace } from "./runner";
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

export async function executeAll({
  code,
  signature,
  testCases,
}: ExecuteOptions): Promise<TraceRun[]> {
  const sig = parseSignature(signature || code);
  const runs: TraceRun[] = [];

  for (const tc of testCases) {
    const { args, names } = parseTestInput(tc.input, sig.params);
    const coercions = inferCoercions(args, names, sig.params);
    const raw = await runTrace(code, sig.name, args, coercions);
    runs.push({
      testCaseName: tc.name,
      args: raw.args,
      steps: raw.steps,
      result: raw.result ?? undefined,
      error: raw.error ?? undefined,
      truncated: raw.truncated,
      passed: raw.error ? false : compareResult(raw.result, tc.expected),
      stdout: raw.stdout,
    });
  }
  return runs;
}
