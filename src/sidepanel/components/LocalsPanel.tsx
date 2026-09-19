import type { TraceStep } from "../../shared/trace";
import { primitiveText } from "./valueUtils";

export function LocalsPanel({ step }: { step: TraceStep | null }) {
  if (!step) return null;
  const entries = Object.entries(step.locals);
  return (
    <div className="locals">
      <div className="locals-header">
        Variables <span className="locals-frame">{step.func}()</span>
        {step.depth > 0 && <span className="locals-depth">depth {step.depth}</span>}
      </div>
      <div className="locals-grid">
        {entries.length === 0 && <span className="locals-empty">—</span>}
        {entries.map(([name, value]) => (
          <div key={name} className="local-chip">
            <span className="local-name">{name}</span>
            <span className="local-value">{primitiveText(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
