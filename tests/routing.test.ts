import { describe, expect, it } from "vitest";
import type { MapDocument, MapEdge, MapNode } from "../src/domain/types";
import {
  buildGraph,
  edgeSeconds,
  FAST_TRAVEL_SECONDS,
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
  type: MapEdge["type"] = "road",
): MapEdge => ({ id, nodes: [from, to], type, note: "", step: 0 });
const open = { avoid: [], dlc: true };

describe("travel cost", () => {
  it("prices path types and follows the rules", () => {
    expect(edgeSeconds("road", 1400, open)).toBe(100);
    expect(edgeSeconds("road", 1200, { avoid: ["torrent"], dlc: true })).toBe(
      200,
    );
    expect(edgeSeconds("torrent", 100, { avoid: ["torrent"], dlc: true })).toBe(
      null,
    );
    expect(edgeSeconds("waygate", 0, open)).toBe(10);
  });
});

describe("shortest paths", () => {
  // a — b — c along a road, d far away, e in the DLC.
  const map: MapDocument = {
    schemaVersion: 2,
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
      edge("drop", "c", "a", "one-way-drop"),
      edge("gate", "a", "e", "waygate"),
    ],
  };

  it("prefers drawn paths over guesses", () => {
    const paths = shortestPaths(buildGraph(map, open, []), "a");
    expect(paths.seconds.get("c")).toBe(200);
    expect(pathTo(paths, "c")?.map((s) => s.via)).toEqual([
      { kind: "edge", id: "ab", type: "road" },
      { kind: "edge", id: "bc", type: "road" },
    ]);
  });

  it("travels a path through several pins hop by hop, either way", () => {
    const line = {
      ...map,
      edges: [{ ...edge("abc", "a", "c"), nodes: ["a", "b", "c"] }],
    };
    const back = shortestPaths(buildGraph(line, open, []), "c");
    expect(back.seconds.get("a")).toBe(200);
    expect(pathTo(back, "a")?.map((s) => [s.from, s.to])).toEqual([
      ["c", "b"],
      ["b", "a"],
    ]);
  });

  it("only drops down a one-way drop", () => {
    // On foot, the 350 s drop beats walking back (467 s), but only from c.
    const walk = {
      ...map,
      edges: map.edges.map((e) =>
        e.type === "road" ? { ...e, type: "foot" as const } : e,
      ),
    };
    const there = shortestPaths(buildGraph(walk, open, []), "a");
    expect(there.seconds.get("c")).toBeCloseTo(2800 / 6);
    const back = shortestPaths(buildGraph(walk, open, []), "c");
    expect(back.seconds.get("a")).toBe(350);
    expect(pathTo(back, "a")?.[0].via).toEqual({
      kind: "edge",
      id: "drop",
      type: "one-way-drop",
    });
  });

  it("guesses straight lines across gaps", () => {
    const paths = shortestPaths(buildGraph(map, open, []), "a");
    const toD = pathTo(paths, "d");
    expect(toD?.at(-1)?.via).toEqual({ kind: "guess" });
    // 47.2 km at Torrent speed, with the guess penalty.
    expect(paths.seconds.get("d")).toBeCloseTo(200 + (47200 / 14) * 1.5);
  });

  it("fast travels to discovered graces", () => {
    const paths = shortestPaths(buildGraph(map, open, ["d"]), "a");
    expect(paths.seconds.get("d")).toBe(FAST_TRAVEL_SECONDS);
    expect(pathTo(paths, "d")).toEqual([
      {
        from: "a",
        to: "d",
        via: { kind: "fast-travel" },
        seconds: FAST_TRAVEL_SECONDS,
      },
    ]);
  });

  it("leaves the DLC out when the playthrough does", () => {
    const withDlc = shortestPaths(buildGraph(map, open, []), "a");
    expect(withDlc.seconds.get("e")).toBe(10);
    const without = shortestPaths(
      buildGraph(map, { avoid: [], dlc: false }, []),
      "a",
    );
    expect(without.seconds.has("e")).toBe(false);
    expect(pathTo(without, "e")).toBe(null);
  });
});
