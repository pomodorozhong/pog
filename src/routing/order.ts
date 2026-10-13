import type {
  MapDocument,
  MapNode,
  Point,
  WishlistItem,
} from "../domain/types";
import {
  pathTo,
  shortestPaths,
  type Graph,
  type ShortestPaths,
  type Step,
} from "./route";

/** Wishlist items still needed that have a pin on the map: the route's targets. */
export function wishlistTargets(
  map: MapDocument,
  wishlist: WishlistItem[],
): { item: string; node: string }[] {
  return wishlist.flatMap((w) => {
    const pin =
      w.status === "needed" &&
      map.nodes.find((n) => n.kind === "item" && n.ref === w.item);
    return pin ? [{ item: w.item, node: pin.id }] : [];
  });
}

/** Shortest paths from each node asked about, computed once. */
export function travelTimes(graph: Graph) {
  const cache = new Map<string, ShortestPaths>();
  const from = (node: string) => {
    let paths = cache.get(node);
    if (!paths) {
      paths = shortestPaths(graph, node);
      cache.set(node, paths);
    }
    return paths;
  };
  return {
    seconds: (a: string, b: string) => from(a).seconds.get(b) ?? Infinity,
    path: (a: string, b: string) => pathTo(from(a), b),
  };
}
type TravelTimes = ReturnType<typeof travelTimes>;

export type PlannedRoute = {
  /** Targets in visiting order. */
  order: string[];
  /** The steps of each leg: start to the first target, then target to target. */
  legs: Step[][];
  seconds: number;
  /** Targets the route can't reach, for example DLC pins with the DLC left out. */
  unreachable: string[];
};

const routeSeconds = (times: TravelTimes, start: string, order: string[]) =>
  order.reduce(
    (sum, node, i) => sum + times.seconds(i ? order[i - 1] : start, node),
    0,
  );

/** Visit every target from `start`: nearest neighbour, then 2-opt. The route ends at its last target. */
export function planRoute(
  times: TravelTimes,
  start: string,
  targets: string[],
): PlannedRoute {
  const unique = [...new Set(targets)].filter((t) => t !== start);
  const unreachable = unique.filter(
    (t) => times.seconds(start, t) === Infinity,
  );
  const left = new Set(unique.filter((t) => !unreachable.includes(t)));
  const order: string[] = [];
  for (let at = start; left.size;) {
    let next = "";
    let best = Infinity;
    for (const t of left) {
      const s = times.seconds(at, t);
      if (s < best) [next, best] = [t, s];
    }
    // Reachable from the start doesn't mean reachable from here (one-way drops).
    if (!next) next = left.values().next().value!;
    order.push(next);
    left.delete(next);
    at = next;
  }

  // 2-opt: reverse a stretch of the route while that makes it shorter.
  let total = routeSeconds(times, start, order);
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++)
      for (let j = i + 1; j < order.length; j++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        const seconds = routeSeconds(times, start, candidate);
        if (seconds < total - 1e-6) {
          order.splice(0, order.length, ...candidate);
          total = seconds;
          improved = true;
        }
      }
  }

  return {
    order,
    legs: order.map(
      (node, i) => times.path(i ? order[i - 1] : start, node) ?? [],
    ),
    seconds: total,
    unreachable,
  };
}

/**
 * What adding `node` to a planned route costs: the cheapest place to slot it
 * in, as extra seconds and the stop to visit it after (null: go there first).
 */
export function detour(
  times: TravelTimes,
  start: string,
  order: string[],
  node: string,
): { seconds: number; after: string | null } | null {
  let best: { seconds: number; after: string | null } | null = null;
  for (let i = 0; i <= order.length; i++) {
    const before = i ? order[i - 1] : start;
    const after = order[i];
    const extra =
      times.seconds(before, node) +
      (after === undefined
        ? 0
        : times.seconds(node, after) - times.seconds(before, after));
    if (extra < Infinity && (!best || extra < best.seconds))
      best = { seconds: extra, after: i ? before : null };
  }
  return best;
}

/** A stretch of the route to draw on one layer. Fast travel and waygate jumps aren't drawn. */
export type RouteLine = {
  layer: MapNode["layer"];
  points: Point[];
  guess: boolean;
};

/** The planned route as lines on the map: each hop is straight between two pins. */
export function routeLines(map: MapDocument, legs: Step[][]): RouteLine[] {
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  return legs.flat().flatMap((step): RouteLine[] => {
    const from = nodes.get(step.from);
    const to = nodes.get(step.to);
    if (!from || !to || from.layer !== to.layer) return [];
    if (step.via.kind === "fast-travel") return [];
    return [
      {
        layer: from.layer,
        points: [
          [from.x, from.y],
          [to.x, to.y],
        ],
        guess: step.via.kind === "guess",
      },
    ];
  });
}
