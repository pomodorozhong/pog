import type { LayerId, MapDocument, MapEdge, MapNode } from "../domain/types";
import type { MapAction } from "../map/editing";

/**
 * The edits that copy another profile's nodes and paths into `target`, as one
 * batch (one undo step).
 *
 * A node already on the target map is reused instead of copied: the same node
 * (same ID, as after an earlier import), or a game grace, which every map
 * shows. Copied paths attach to it, and importing again only brings what's
 * new. With a layer, only that layer's nodes are copied; a path is copied when
 * both its ends are on the target map afterwards, so a waygate can join a
 * reused node on another layer.
 */
export function importMap(
  target: MapDocument,
  source: MapDocument,
  layer?: LayerId,
): { action: MapAction; nodes: number; edges: number } {
  const nodeIds = new Set(target.nodes.map((n) => n.id));

  // Where each source node ends up on the target map.
  const placed = new Map<string, string>();
  const nodes: MapNode[] = [];
  for (const node of source.nodes) {
    if (nodeIds.has(node.id)) placed.set(node.id, node.id);
    else if (!layer || node.layer === layer) {
      placed.set(node.id, node.id);
      nodes.push(node);
    }
  }
  const endOf = (id: string) =>
    placed.get(id) ?? (nodeIds.has(id) ? id : undefined);

  const edgeIds = new Set(target.edges.map((e) => e.id));
  // A path of the same type between the same two nodes is already drawn.
  const drawn = new Set(
    target.edges.flatMap((e) => [
      `${e.from} ${e.to} ${e.type}`,
      `${e.to} ${e.from} ${e.type}`,
    ]),
  );
  const edges: MapEdge[] = [];
  for (const edge of source.edges) {
    const from = endOf(edge.from);
    const to = endOf(edge.to);
    if (!from || !to || from === to || edgeIds.has(edge.id)) continue;
    if (drawn.has(`${from} ${to} ${edge.type}`)) continue;
    edges.push({ ...edge, from, to });
  }

  return {
    action: {
      type: "batch",
      actions: [
        ...nodes.map((node): MapAction => ({ type: "addNode", node })),
        ...edges.map((edge): MapAction => ({ type: "addEdge", edge })),
      ],
    },
    nodes: nodes.length,
    edges: edges.length,
  };
}
