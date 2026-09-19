import type { SerializedValue, TraceRun, TraceStep } from "../../shared/trace";
import { ArrayView } from "./ArrayView";
import { LinkedListView } from "./LinkedListView";
import { TreeView } from "./TreeView";
import { StringView } from "./StringView";
import { AuxView } from "./AuxView";
import {
  extractArrays,
  extractAux,
  extractLinkedLists,
  extractStrings,
  extractTrees,
  primitiveText,
} from "./valueUtils";

function ResultValue({ value }: { value: SerializedValue }) {
  if (value.kind === "array") return <ArrayView array={{ name: "return", items: value.items, pointers: [] }} />;
  if (value.kind === "linked_list")
    return <LinkedListView list={{ name: "return", nodes: value.nodes, pointerByNodeId: new Map() }} />;
  if (value.kind === "tree" && value.root)
    return <TreeView tree={{ name: "return", root: value.root }} />;
  return <div className="result-scalar">{primitiveText(value)}</div>;
}

export function Stage({ run, step }: { run: TraceRun; step: TraceStep | null }) {
  const isException = step?.event === "exception" || (run.error != null && step === run.steps[run.steps.length - 1]);

  if (!step) {
    return <div className="stage stage--empty">No steps to display.</div>;
  }

  const arrays = extractArrays(step, run.indexVars);
  const lists = extractLinkedLists(step);
  const trees = extractTrees(step);
  const strings = extractStrings(step, run.indexVars);
  const aux = extractAux(step);
  const nothing = arrays.length === 0 && lists.length === 0 && trees.length === 0 && strings.length === 0;

  return (
    <div className={`stage${isException ? " stage--error" : ""}`}>
      {trees.map((t) => (
        <TreeView key={t.name} tree={t} />
      ))}
      {lists.map((l) => (
        <LinkedListView key={l.name} list={l} />
      ))}
            {strings.map((s) => (
        <StringView key={s.name} str={s} />
      ))}
      {arrays.map((a) => (
        <ArrayView key={a.name} array={a} />
      ))}
      {strings.length > 0 &&
        aux.map((a) => <AuxView key={a.name} aux={a} />)}

      {nothing && (
        <div className="stage--empty">
          No array / linked-list / tree in scope at this step. Watch the Variables
          panel below.
        </div>
      )}

      {step.event === "return" && step.returnValue && step.depth === 0 && (
        <div className="viz-block viz-block--result">
          <div className="viz-label">returns</div>
          <ResultValue value={step.returnValue} />
        </div>
      )}
    </div>
  );
}
