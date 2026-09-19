import type { NamedAux } from "./valueUtils";

export function AuxView({ aux }: { aux: NamedAux }) {
  return (
    <div className="viz-block viz-block--aux">
      <div className="viz-label">
        {name_of(aux)} <span className="viz-sub">{aux.entries.length}</span>
      </div>
      <div className="aux-row">
        {aux.entries.length === 0 && <span className="aux-empty">empty</span>}
        {aux.entries.map((e) => (
          <span key={e.key} className="aux-chip">
            {e.key}
            {e.value != null && <span className="aux-chip-val">{e.value}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function name_of(aux: NamedAux) {
  return `${aux.name} (${aux.kind})`;
}