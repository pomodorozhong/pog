import type { MapDocument, MapNode, RouteRules } from "../domain/types";

// Costs are metres travelled, since paths say nothing about how fast they go.
// One map pixel is one metre: the world-to-map transform only shifts
// coordinates. Jumps count as a short walk, so they win over long paths but
// not over the next pin along.
export const FAST_TRAVEL_COST = 200;
const TELEPORT_COST = 100;
/** Unexplored gaps are guessed as straight lines to this many nearest nodes. */
const GUESS_NEIGHBOURS = 6;
/** A guess costs more than a drawn path of the same length, so drawn paths win. */
const GUESS_PENALTY = 1.5;
const DLC_LAYERS = new Set(["dlc", "dlc-underground"]);

/** How one step of a route is travelled. */
export type Via =
  | { kind: "edge"; id: string; teleport: boolean }
  | { kind: "guess" }
  | { kind: "fast-travel" };
export type Step = { from: string; to: string; via: Via; cost: number };

type Arc = { to: string; via: Via; cost: number };
export type Graph = {
  nodes: Map<string, MapNode>;
  arcs: Map<string, Arc[]>;
  /** Graces the player can fast travel to. */
  fastTravel: string[];
};

/**
 * The profile's map as a routing graph: drawn paths, straight guesses between
 * nearby nodes on the same layer, and fast travel to `discovered` graces
 * (node IDs). DLC nodes are left out when the playthrough skips the DLC.
 */
export function buildGraph(
  map: MapDocument,
  rules: RouteRules,
  discovered: Iterable<string>,
): Graph {
  const nodes = new Map(
    map.nodes
      .filter((n) => rules.dlc || !DLC_LAYERS.has(n.layer))
      .map((n) => [n.id, n]),
  );
  const arcs = new Map<string, Arc[]>([...nodes.keys()].map((id) => [id, []]));
  const add = (from: string, arc: Arc) => arcs.get(from)?.push(arc);
  // Nodes joined by drawn paths, whichever way they run.
  const group = new Map<string, string>();
  const root = (id: string): string => {
    const parent = group.get(id) ?? id;
    if (parent === id) return id;
    const top = root(parent);
    group.set(id, top);
    return top;
  };

  // Each pair of neighbouring pins on a path is one hop.
  for (const edge of map.edges)
    for (const [i, id] of edge.nodes.entries()) {
      const from = nodes.get(edge.nodes[i - 1]);
      const to = nodes.get(id);
      if (!from || !to) continue;
      const cost = edge.teleport
        ? TELEPORT_COST
        : Math.hypot(to.x - from.x, to.y - from.y);
      group.set(root(from.id), root(to.id));
      const via: Via = { kind: "edge", id: edge.id, teleport: edge.teleport };
      add(from.id, { to: to.id, via, cost });
      if (!edge.oneWay) add(to.id, { to: from.id, via, cost });
    }

  // Guesses only bridge pieces the drawn paths don't connect, so a path drawn
  // around a cliff isn't undercut by a straight line.
  const byLayer = new Map<string, MapNode[]>();
  for (const n of nodes.values())
    byLayer.set(n.layer, [...(byLayer.get(n.layer) ?? []), n]);
  for (const layerNodes of byLayer.values())
    for (const node of layerNodes) {
      const nearest = layerNodes
        .filter((n) => root(n.id) !== root(node.id))
        .map((n) => ({ n, d: Math.hypot(n.x - node.x, n.y - node.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, GUESS_NEIGHBOURS);
      for (const { n, d } of nearest) {
        const cost = d * GUESS_PENALTY;
        add(node.id, { to: n.id, via: { kind: "guess" }, cost });
        add(n.id, { to: node.id, via: { kind: "guess" }, cost });
      }
    }

  return {
    nodes,
    arcs,
    fastTravel: [...discovered].filter((id) => nodes.has(id)),
  };
}

export type ShortestPaths = {
  cost: Map<string, number>;
  /** The step that reaches each node on its cheapest path. */
  previous: Map<string, Step>;
};

/** Dijkstra from `source`, where fast travel to a discovered grace is one cheap jump. */
export function shortestPaths(graph: Graph, source: string): ShortestPaths {
  const cost = new Map<string, number>();
  const previous = new Map<string, Step>();
  if (!graph.nodes.has(source)) return { cost, previous };
  const heap = new MinHeap();
  const relax = (from: string, arc: Arc, base: number) => {
    const total = base + arc.cost;
    if (total < (cost.get(arc.to) ?? Infinity)) {
      cost.set(arc.to, total);
      previous.set(arc.to, { from, ...arc });
      heap.push(arc.to, total);
    }
  };
  cost.set(source, 0);
  heap.push(source, 0);
  // Fast travel works from anywhere, so the cheapest jump is from the start.
  for (const grace of graph.fastTravel)
    if (grace !== source)
      relax(
        source,
        {
          to: grace,
          via: { kind: "fast-travel" },
          cost: FAST_TRAVEL_COST,
        },
        0,
      );
  const done = new Set<string>();
  for (let entry = heap.pop(); entry; entry = heap.pop()) {
    const [node, base] = entry;
    if (done.has(node)) continue;
    done.add(node);
    for (const arc of graph.arcs.get(node) ?? []) relax(node, arc, base);
  }
  return { cost, previous };
}

/** The steps from the source of `paths` to `target`, or null if unreachable. */
export function pathTo(paths: ShortestPaths, target: string): Step[] | null {
  if (!paths.cost.has(target)) return null;
  const steps: Step[] = [];
  for (
    let at = paths.previous.get(target);
    at;
    at = paths.previous.get(at.from)
  )
    steps.unshift(at);
  return steps;
}

class MinHeap {
  private items: [string, number][] = [];
  push(id: string, cost: number) {
    const items = this.items;
    items.push([id, cost]);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (items[parent][1] <= items[i][1]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): [string, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let min = i;
        if (l < items.length && items[l][1] < items[min][1]) min = l;
        if (r < items.length && items[r][1] < items[min][1]) min = r;
        if (min === i) break;
        [items[min], items[i]] = [items[i], items[min]];
        i = min;
      }
    }
    return top;
  }
}
