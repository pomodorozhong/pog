import {
  isWalked,
  type LayerId,
  type MapDocument,
  type MapEdge,
  type MapNode,
} from "../domain/types";
import { inStepOrder, type MapAction } from "../map/editing";

/**
 * The edits that copy another profile's nodes and paths into `target`, as one
 * batch (one undo step).
 *
 * A node already on the target map is reused instead of copied: the same node
 * (same ID, as after an earlier import), or a game grace, which every map
 * shows. Copied paths attach to it, and importing again only brings what's
 * new. With a layer, only that layer's nodes are copied; a path is copied when
 * all its pins are on the target map afterwards, so a waygate can join a
 * reused node on another layer. Copied paths keep their order and follow the
 * target's last step. Note paths come along with their pin, unless the pin
 * already has a note on the target map. So do what was added to game graces.
 */
export function importMap(
  target: MapDocument,
  source: MapDocument,
  layer?: LayerId,
): { action: MapAction; nodes: number; edges: number; graces: number } {
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
  // A path through the same pins, either way, is already drawn.
  const drawn = new Set(
    target.edges.flatMap((e) => [
      e.nodes.join(" "),
      [...e.nodes].reverse().join(" "),
    ]),
  );
  const edges: MapEdge[] = [];
  for (const edge of [
    ...inStepOrder(source.edges),
    ...source.edges.filter((e) => !isWalked(e)),
  ]) {
    const pins = edge.nodes.map(endOf);
    if (edgeIds.has(edge.id) || pins.some((id) => !id)) continue;
    const nodes = pins as string[];
    if (drawn.has(nodes.join(" "))) continue;
    edges.push({ ...edge, nodes });
  }

  // What was added to graces: items and bosses join the grace's own, a label or
  // entrance comes along only if the grace has none here.
  const graces: MapAction[] = [];
  for (const [id, added] of Object.entries(source.graces ?? {})) {
    const grace = target.nodes.find((n) => n.id === id);
    if (!grace || (layer && grace.layer !== layer)) continue;
    const joined = (own: string[] = [], more: string[] = []) => [
      ...own,
      ...more.filter((i) => !own.includes(i)),
    ];
    const items = joined(grace.items, added.items);
    const bosses = joined(grace.bosses, added.bosses);
    const changes = {
      ...(!grace.label && added.label ? { label: added.label } : {}),
      ...(!grace.place && added.place ? { place: added.place } : {}),
      ...(items.length > (grace.items?.length ?? 0) ? { items } : {}),
      ...(bosses.length > (grace.bosses?.length ?? 0) ? { bosses } : {}),
    };
    if (Object.keys(changes).length)
      graces.push({ type: "updateNode", id, changes });
  }

  return {
    action: {
      type: "batch",
      actions: [
        ...nodes.map((node): MapAction => ({ type: "addNode", node })),
        ...edges.map((edge): MapAction => ({ type: "addEdge", edge })),
        ...graces,
      ],
    },
    nodes: nodes.length,
    edges: edges.length,
    graces: graces.length,
  };
}
