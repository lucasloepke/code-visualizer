import { motion } from "framer-motion";
import type { NamedString } from "./valueUtils";

export function StringView({ str }: { str: NamedString }) {
  const { name, chars, pointers, window } = str;
  const byIndex = new Map<number, string[]>();
  for (const p of pointers) {
    const arr = byIndex.get(p.index) ?? [];
    arr.push(p.name);
    byIndex.set(p.index, arr);
  }

  return (
    <div className="viz-block">
      <div className="viz-label">
        {name}
        {window && (
          <span className="viz-sub">
            {" "}
            window [{window.start}…{window.end}] · len {window.end - window.start + 1}
          </span>
        )}
      </div>
      <div className="char-row">
        {chars.map((ch, i) => {
          const inWindow = window != null && i >= window.start && i <= window.end;
          const ptrs = byIndex.get(i);
          return (
            <div key={i} className="char-col">
              <div className="char-ptrs">{ptrs ? ptrs.join(",") : ""}</div>
              <motion.div
                layout
                className={`char-cell${inWindow ? " char-cell--window" : ""}${
                  ptrs ? " char-cell--ptr" : ""
                }`}
                animate={{ scale: ptrs ? 1.08 : 1 }}
                transition={{ duration: 0.15 }}
              >
                {ch === " " ? "␠" : ch}
              </motion.div>
              <div className="char-idx">{i}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}