import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode } from "../src/domain/types";
import {
  detour,
  planRoute,
  routeLines,
  travelTimes,
  wishlistTargets,
} from "../src/routing/order";
import { buildGraph } from "../src/routing/route";

const node = (id: string, x: number, y = 0): MapNode => ({
  id,
  layer: "overworld",
  x,
  y,
  kind: "junction",
  label: "",
  ref: null,
});
/** Points on a line, joined by a road in the given order. */
function line(ids: string[], xs: number[]): MapDocument {
  return {
    schemaVersion: 2,
    nodes: ids.map((id, i) => node(id, xs[i])),
    edges: ids.slice(1).map((id, i) => ({
      id: `e${i}`,
      nodes: [ids[i], id],
      type: "road" as const,
      note: "",
      step: i + 1,
    })),
  };
}
const open = { avoid: [], dlc: true };

describe("visit order", () => {
  // Along one road: start at 0, targets at 1400, 2800 and 5600 metres.
  const map = line(["s", "a", "b", "c"], [0, 1400, 2800, 5600]);
  const times = travelTimes(buildGraph(map, open, []));

  it("visits targets along the way in order", () => {
    const route = planRoute(times, "s", ["c", "a", "b"]);
    expect(route.order).toEqual(["a", "b", "c"]);
    expect(route.seconds).toBe(400);
    expect(route.legs.map((leg) => leg.length)).toEqual([1, 1, 1]);
    expect(route.unreachable).toEqual([]);
  });

  it("estimates the detour for a new target", () => {
    // b sits on the way from a to c: it costs nothing extra.
    expect(detour(times, "s", ["a", "c"], "b")).toEqual({
      seconds: 0,
      after: "a",
    });
    // Starting with a lone far target, a nearer one goes first.
    expect(detour(times, "s", ["c"], "a")).toEqual({ seconds: 0, after: null });
  });

  it("improves on nearest neighbour with 2-opt", () => {
    // On a line from 0: nearest neighbour goes to a (+1 km), back past the
    // start to b (−2 km), then out to c (+10 km): 16 km. b, a, c is 14 km.
    const spread: MapDocument = {
      schemaVersion: 2,
      nodes: [
        node("s", 0),
        node("a", 1000),
        node("b", -2000),
        node("c", 10000),
      ],
      edges: [],
    };
    const route = planRoute(travelTimes(buildGraph(spread, open, [])), "s", [
      "a",
      "b",
      "c",
    ]);
    expect(route.order).toEqual(["b", "a", "c"]);
  });
});

describe("route targets", () => {
  it("takes needed wishlist items that have a pin", () => {
    const map: MapDocument = {
      schemaVersion: 2,
      nodes: [
        { ...node("pin", 0), kind: "item", ref: "weapon/1" },
        { ...node("got", 0), kind: "item", ref: "weapon/2" },
      ],
      edges: [],
    };
    expect(
      wishlistTargets(map, [
        { item: "weapon/1", status: "needed", note: "" },
        { item: "weapon/2", status: "acquired", note: "" },
        { item: "weapon/3", status: "needed", note: "" },
      ]),
    ).toEqual([{ item: "weapon/1", node: "pin" }]);
  });
});

describe("route lines", () => {
  it("draws drawn paths as drawn and guesses as straight lines", () => {
    const map = line(["s", "a"], [0, 1400]);
    map.nodes.push(node("far", 30000));
    const times = travelTimes(buildGraph(map, open, []));
    const route = planRoute(times, "s", ["a", "far"]);
    expect(routeLines(map, route.legs)).toEqual([
      {
        layer: "overworld",
        points: [
          [0, 0],
          [1400, 0],
        ],
        guess: false,
      },
      {
        layer: "overworld",
        points: [
          [1400, 0],
          [30000, 0],
        ],
        guess: true,
      },
    ]);
  });
});
