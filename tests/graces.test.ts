import { describe, expect, it } from "vitest";
import type { MapDocument, MapEdge, MapNode } from "../src/domain/types";
import type { CatalogGrace } from "../src/map/catalog";
import { applyMapAction } from "../src/map/editing";
import { gameGraceNodes, withGameGraces } from "../src/map/graces";
import { validDocument } from "../src/storage/schema";

const grace = (
  id: number,
  x: number,
  y: number,
  en = `Grace ${id}`,
  layer: CatalogGrace["layer"] = "overworld",
): CatalogGrace => ({
  id: `grace/${id}`,
  name: { en, "zh-TW": en },
  dlc: false,
  layer,
  x,
  y,
  flag: 70000 + id,
  legacy: false,
});
const node = (
  id: string,
  x: number,
  y: number,
  kind: MapNode["kind"] = "junction",
  ref: string | null = null,
): MapNode => ({ id, layer: "overworld", x, y, kind, label: "", ref });
const edge = (
  id: string,
  from: string,
  to: string,
  type: MapEdge["type"] = "road",
): MapEdge => ({ id, nodes: [from, to], type, note: "", step: 0 });
const doc = (nodes: MapNode[] = [], edges: MapEdge[] = []): MapDocument => ({
  schemaVersion: 2,
  nodes,
  // Paths are walked in the order given.
  edges: edges.map((e, i) => ({ ...e, step: i + 1 })),
});

const graces = gameGraceNodes([
  grace(1, 100, 100),
  grace(2, 500, 500),
  grace(4, 50, 50, "Underground", "underground"),
]);
const fixed = new Map(graces.map((n) => [n.id, n]));

describe("game graces", () => {
  it("are nodes named by their grace id, linked to it", () => {
    expect(graces[0]).toEqual({
      id: "grace/1",
      layer: "overworld",
      x: 100,
      y: 100,
      kind: "grace",
      label: "",
      ref: "grace/1",
    });
  });

  it("leave out a grace with the same name and spot as an earlier one", () => {
    const twins = gameGraceNodes([
      grace(10, 300, 300, "Elden Throne"),
      grace(11, 301, 300, "Elden Throne"),
      grace(12, 300, 300, "Elsewhere"),
    ]);
    expect(twins.map((n) => n.id)).toEqual(["grace/10", "grace/12"]);
  });

  it("show on the map without being stored", () => {
    const mine = doc([node("j", 1, 2)]);
    expect(withGameGraces(mine, graces).nodes.map((n) => n.id)).toEqual([
      "grace/1",
      "grace/2",
      "grace/4",
      "j",
    ]);
    expect(mine.nodes).toHaveLength(1);
  });

  it("can end a path but can't be moved or removed", () => {
    const start = doc([node("j", 1, 2)]);
    const joined = applyMapAction(
      start,
      { type: "addEdge", edge: edge("e", "j", "grace/1") },
      fixed,
    );
    expect(joined.edges).toHaveLength(1);
    expect(validDocument("map", joined)).toBe(true);
    for (const action of [
      { type: "updateNode", id: "grace/1", changes: { x: 9 } },
      { type: "removeNode", id: "grace/1" },
    ] as const)
      expect(applyMapAction(joined, action, fixed)).toBe(joined);
    // Only waygates join layers, game graces included.
    expect(
      applyMapAction(
        start,
        { type: "addEdge", edge: edge("e", "j", "grace/4") },
        fixed,
      ),
    ).toBe(start);
    // Without the game graces, a path to one has nowhere to end.
    expect(
      applyMapAction(start, {
        type: "addEdge",
        edge: edge("e", "j", "grace/1"),
      }),
    ).toBe(start);
  });
});

describe("a stored map", () => {
  it("holds no graces: none as a node, none taking a grace's id", () => {
    expect(validDocument("map", doc([node("hand", 1, 2, "grace")]))).toBe(
      false,
    );
    expect(validDocument("map", doc([node("grace/1", 1, 2)]))).toBe(false);
  });
});
