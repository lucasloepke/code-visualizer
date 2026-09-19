import { motion } from "framer-motion";
import type { NamedTree } from "./valueUtils";
import type { TreeNode } from "../../shared/trace";
import { primitiveText } from "./valueUtils";

interface Positioned {
  id: number;
  label: string;
  x: number;
  y: number;
}
interface Edge {
  from: number;
  to: number;
  fromXY: [number, number];
  toXY: [number, number];
}

const NODE = 34;
const H_GAP = 30;
const V_GAP = 56;

/** In-order x assignment, depth-based y. Returns nodes + edges in px. */
function layout(root: TreeNode | null) {
  const nodes: Positioned[] = [];
  const edges: Edge[] = [];
  let counter = 0;
  const centerX = (i: number) => i * (NODE + H_GAP) + NODE / 2;
  const centerY = (d: number) => d * V_GAP + NODE / 2;

  function walk(node: TreeNode | null, depth: number): number | null {
    if (!node) return null;
    walk(node.left, depth + 1);
    const myCol = counter++;
    const pos: Positioned = {
      id: node.id,
      label: primitiveText(node.value),
      x: centerX(myCol),
      y: centerY(depth),
    };
    nodes.push(pos);
    for (const child of [node.left, node.right]) {
      if (child) {
        // child position resolved after full walk; record ids, fix later
        edges.push({ from: node.id, to: child.id, fromXY: [0, 0], toXY: [0, 0] });
      }
    }
    walk(node.right, depth + 1);
    return myCol;
  }
  walk(root, 0);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    e.fromXY = [a.x, a.y];
    e.toXY = [b.x, b.y];
  }
  const width = Math.max(NODE, counter * (NODE + H_GAP));
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0) + NODE;
  return { nodes, edges, width, height: maxY };
}

export function TreeView({ tree }: { tree: NamedTree }) {
  const { nodes, edges, width, height } = layout(tree.root);
  return (
    <div className="viz-block">
      <div className="viz-label">{tree.name}</div>
      <div className="tree-canvas" style={{ width, height }}>
        <svg className="tree-edges" width={width} height={height}>
          {edges.map((e) => (
            <line
              key={`${e.from}-${e.to}`}
              x1={e.fromXY[0]}
              y1={e.fromXY[1]}
              x2={e.toXY[0]}
              y2={e.toXY[1]}
              className="tree-edge"
            />
          ))}
        </svg>
        {nodes.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={false}
            animate={{ left: n.x - NODE / 2, top: n.y - NODE / 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="tree-node"
            style={{ width: NODE, height: NODE }}
          >
            {n.label}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
