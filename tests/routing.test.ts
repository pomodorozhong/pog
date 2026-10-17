import { describe, expect, it } from "vitest";
import type { MapDocument, MapEdge, MapNode } from "../src/domain/types";
import { newPath } from "../src/map/editing";
import {
  buildGraph,
  FAST_TRAVEL_COST,
  pathTo,
  shortestPaths,
} from "../src/routing/route";

const node = (
  id: string,
  x: number,
  y = 0,
  layer: MapNode["layer"] = "overworld",
): MapNode => ({ id, layer, x, y, kind: "junction", label: "", ref: null });
const edge = (
  id: string,
  from: string,
  to: string,
  options: Partial<MapEdge> = {},
): MapEdge => ({ ...newPath(id, [from, to]), step: 0, ...options });
const open = { dlc: true };

describe("shortest paths", () => {
  // a — b — c along a path, d far away, e in the DLC.
  const map: MapDocument = {
    schemaVersion: 3,
    nodes: [
      node("a", 0),
      node("b", 1400),
      node("c", 2800),
      node("d", 50000),
      node("e", 0, 0, "dlc"),
    ],
    edges: [
      edge("ab", "a", "b"),
      edge("bc", "b", "c"),
      edge("gate", "a", "e", { teleport: true }),
    ],
  };
  const walk = { kind: "edge", teleport: false };

  it("prefers drawn paths over guesses, by distance", () => {
    const paths = shortestPaths(buildGraph(map, open, []), "a");
    expect(paths.cost.get("c")).toBe(2800);
    expect(pathTo(paths, "c")?.map((s) => s.via)).toEqual([
      { ...walk, id: "ab" },
      { ...walk, id: "bc" },
    ]);
  });

  it("travels a path through several pins hop by hop, either way", () => {
    const line = {
      ...map,
      edges: [{ ...edge("abc", "a", "c"), nodes: ["a", "b", "c"] }],
    };
    const back = shortestPaths(buildGraph(line, open, []), "c");
    expect(back.cost.get("a")).toBe(2800);
    expect(pathTo(back, "a")?.map((s) => [s.from, s.to])).toEqual([
      ["c", "b"],
      ["b", "a"],
    ]);
  });

  it("only travels a one-way path in drawing order", () => {
    // The path from a to c winds through b; a drop goes straight back down.
    const winding = {
      ...map,
      nodes: map.nodes.map((n) => (n.id === "b" ? node("b", 1400, 1000) : n)),
      edges: [...map.edges, edge("drop", "c", "a", { oneWay: true })],
    };
    const around = 2 * Math.hypot(1400, 1000);
    const there = shortestPaths(buildGraph(winding, open, []), "a");
    expect(there.cost.get("c")).toBeCloseTo(around);
    const back = shortestPaths(buildGraph(winding, open, []), "c");
    expect(back.cost.get("a")).toBe(2800);
    expect(pathTo(back, "a")?.[0].via).toEqual({ ...walk, id: "drop" });
  });

  it("guesses straight lines across gaps", () => {
    const paths = shortestPaths(buildGraph(map, open, []), "a");
    const toD = pathTo(paths, "d");
    expect(toD?.at(-1)?.via).toEqual({ kind: "guess" });
    // 47.2 km with the guess penalty.
    expect(paths.cost.get("d")).toBeCloseTo(2800 + 47200 * 1.5);
  });

  it("teleports for a fixed cost, whatever the distance", () => {
    const far = {
      ...map,
      edges: [...map.edges, edge("belfry", "a", "d", { teleport: true })],
    };
    const paths = shortestPaths(buildGraph(far, open, []), "a");
    expect(paths.cost.get("d")).toBe(100);
    expect(pathTo(paths, "d")?.[0].via).toEqual({
      kind: "edge",
      id: "belfry",
      teleport: true,
    });
  });

  it("fast travels to discovered graces", () => {
    const paths = shortestPaths(buildGraph(map, open, ["d"]), "a");
    expect(paths.cost.get("d")).toBe(FAST_TRAVEL_COST);
    expect(pathTo(paths, "d")).toEqual([
      {
        from: "a",
        to: "d",
        via: { kind: "fast-travel" },
        cost: FAST_TRAVEL_COST,
      },
    ]);
  });

  it("leaves the DLC out when the playthrough does", () => {
    const withDlc = shortestPaths(buildGraph(map, open, []), "a");
    expect(withDlc.cost.get("e")).toBe(100);
    const without = shortestPaths(buildGraph(map, { dlc: false }, []), "a");
    expect(without.cost.has("e")).toBe(false);
    expect(pathTo(without, "e")).toBe(null);
  });
});
