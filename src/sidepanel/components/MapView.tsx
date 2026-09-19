import { motion } from "framer-motion";
import type { NamedMap } from "./valueUtils";
import { primitiveText } from "./valueUtils";

/**
 * Hashmap / dict visualization: key → value pairs laid out as chips that
 * animate in as entries are inserted (Two Sum's `seen` / `hashmap`, etc.).
 */
export function MapView({ map }: { map: NamedMap }) {
  const activeKey = map.highlightedKey;

  return (
    <div className="viz-block">
      <div className="viz-label">{map.name}</div>
      <div className="map-row">
        {map.entries.map((entry) => {
          const keyText = primitiveText(entry.key);
          const active = activeKey != null && keyText === activeKey;
          return (
            <motion.div
              key={`${map.name}:${keyText}`}
              layout
              className={`map-entry${active ? " map-entry--active" : ""}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
            >
              <span className="map-key">{keyText}</span>
              <span className="map-arrow">→</span>
              <span className="map-value">{primitiveText(entry.value)}</span>
            </motion.div>
          );
        })}
        {map.entries.length === 0 && <div className="array-empty">{"{}"}</div>}
      </div>
    </div>
  );
}
