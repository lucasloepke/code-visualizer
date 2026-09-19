import { motion } from "framer-motion";
import type { NamedArray } from "./valueUtils";
import { primitiveText } from "./valueUtils";

/**
 * Build a stable key per cell. If all values in the array are unique we key by
 * value (so Framer Motion tweens position when the array reorders, e.g. an
 * in-place reversal). Otherwise we fall back to index (fine for the common
 * two-pointer case where the array itself doesn't move).
 */
function keysForArray(arr: NamedArray): string[] {
  const texts = arr.items.map(primitiveText);
  const unique = new Set(texts).size === texts.length;
  return texts.map((t, i) => (unique ? `${arr.name}:v:${t}` : `${arr.name}:i:${i}`));
}

export function ArrayView({ array }: { array: NamedArray }) {
  const keys = keysForArray(array);
  const pointerByIndex = new Map<number, string[]>();
  for (const p of array.pointers) {
    const list = pointerByIndex.get(p.index) ?? [];
    list.push(p.name);
    pointerByIndex.set(p.index, list);
  }

  return (
    <div className="viz-block">
      <div className="viz-label">{array.name}</div>
      <div className="array-row">
        {array.items.map((item, i) => {
          const ptrs = pointerByIndex.get(i);
          return (
            <motion.div key={keys[i]} layout className="array-cell-wrap" transition={{ type: "spring", stiffness: 500, damping: 34 }}>
              <div className="array-ptrs">
                {ptrs?.map((name) => (
                  <span key={name} className="ptr-badge">
                    {name}
                  </span>
                ))}
              </div>
              <div className={`array-cell${ptrs ? " array-cell--active" : ""}`}>
                {primitiveText(item)}
              </div>
              <div className="array-index">{i}</div>
            </motion.div>
          );
        })}
        {array.items.length === 0 && <div className="array-empty">[]</div>}
      </div>
    </div>
  );
}
