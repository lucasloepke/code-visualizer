import type { TraceRun } from "../../shared/trace";

function badge(run: TraceRun): { text: string; cls: string } {
  if (run.error) return { text: "error", cls: "badge--error" };
  if (run.truncated) return { text: "∞?", cls: "badge--warn" };
  if (run.passed === true) return { text: "pass", cls: "badge--pass" };
  if (run.passed === false) return { text: "fail", cls: "badge--fail" };
  return { text: "done", cls: "badge--neutral" };
}

export function TestCaseTabs({
  runs,
  activeIndex,
  onSelect,
}: {
  runs: TraceRun[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="tabs">
      {runs.map((run, i) => {
        const b = badge(run);
        return (
          <button
            key={run.testCaseName + i}
            className={`tab${i === activeIndex ? " tab--active" : ""}`}
            onClick={() => onSelect(i)}
          >
            <span className="tab-name">{run.testCaseName}</span>
            <span className={`badge ${b.cls}`}>{b.text}</span>
          </button>
        );
      })}
    </div>
  );
}
