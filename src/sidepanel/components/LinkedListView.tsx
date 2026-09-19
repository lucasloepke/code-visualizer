import { AnimatePresence, motion } from "framer-motion";
import type { NamedLinkedList } from "./valueUtils";
import { primitiveText } from "./valueUtils";

/**
 * Renders a singly-linked list. Each node is keyed by its Python id() (stable
 * across steps), so when the list reorders (e.g. reverseList) Framer Motion's
 * layout prop tweens each node to its new position automatically -- we never
 * write manual move logic.
 */
export function LinkedListView({ list }: { list: NamedLinkedList }) {
  return (
    <div className="viz-block">
      <div className="viz-label">{list.name}</div>
      <div className="ll-row">
        <AnimatePresence initial={false}>
          {list.nodes.map((node, i) => {
            const ptrs = list.pointerByNodeId.get(node.id);
            return (
              <motion.div
                key={node.id}
                layout
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="ll-node-wrap"
              >
                <div className="ll-ptrs">
                  {ptrs?.map((name) => (
                    <span key={name} className="ptr-badge">
                      {name}
                    </span>
                  ))}
                </div>
                <div className={`ll-node${ptrs ? " ll-node--active" : ""}`}>
                  {primitiveText(node.value)}
                </div>
                {i < list.nodes.length - 1 && <div className="ll-arrow">→</div>}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {list.nodes.length === 0 && <div className="array-empty">null</div>}
      </div>
    </div>
  );
}
