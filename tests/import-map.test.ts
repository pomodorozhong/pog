import { describe, expect, it } from "vitest";
import type { MapDocument, MapEdge, MapNode } from "../src/domain/types";
import { applyMapAction } from "../src/map/editing";
import { importMap } from "../src/profiles/importMap";

const node = (id: string, changes: Partial<MapNode> = {}): MapNode => ({
  id,
  layer: "overworld",
  x: 1,
  y: 2,
  kind: "junction",
  label: "",
  ref: null,
  ...changes,
});
const edge = (
  id: string,
  from: string,
  to: string,
  type: MapEdge["type"] = "road",
): MapEdge => ({ id, from, to, type, points: [], note: "" });
const doc = (nodes: MapNode[], edges: MapEdge[] = []): MapDocument => ({
  schemaVersion: 1,
  nodes,
  edges,
});

describe("import from another profile", () => {
  const source = doc(
    [
      node("elleh", { kind: "grace", ref: "grace/1" }),
      node("j"),
      node("cave", { layer: "underground", kind: "entrance" }),
    ],
    [edge("road", "elleh", "j"), edge("down", "j", "cave", "waygate")],
  );

  it("copies nodes and paths, attaching paths to graces already placed", () => {
    const target = doc([node("mine", { kind: "grace", ref: "grace/1" })]);
    const copied = importMap(target, source);
    expect(copied).toMatchObject({ nodes: 2, edges: 2 });
    const result = applyMapAction(target, copied.action);
    expect(result.nodes.map((n) => n.id)).toEqual(["mine", "j", "cave"]);
    expect(result.edges.map((e) => [e.from, e.to])).toEqual([
      ["mine", "j"],
      ["j", "cave"],
    ]);
    // Importing again brings nothing new.
    expect(importMap(result, source)).toMatchObject({ nodes: 0, edges: 0 });
  });

  it("copies one layer, keeping waygates to nodes already on the map", () => {
    const empty = doc([]);
    const overworld = applyMapAction(
      empty,
      importMap(empty, source, "overworld").action,
    );
    expect(overworld.nodes.map((n) => n.id)).toEqual(["elleh", "j"]);
    expect(overworld.edges.map((e) => e.id)).toEqual(["road"]);
    const both = applyMapAction(
      overworld,
      importMap(overworld, source, "underground").action,
    );
    expect(both.edges.map((e) => e.id)).toEqual(["road", "down"]);
  });

  it("skips a path already drawn between the same nodes", () => {
    const target = doc(
      [node("mine", { kind: "grace", ref: "grace/1" }), node("j")],
      [edge("other", "j", "mine")],
    );
    expect(importMap(target, source, "overworld")).toMatchObject({
      nodes: 0,
      edges: 0,
    });
  });
});
