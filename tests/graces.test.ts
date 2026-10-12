import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode } from "../src/domain/types";
import type { CatalogGrace } from "../src/map/catalog";
import { applyMapAction, historyReducer } from "../src/map/editing";
import { importGraces } from "../src/map/graces";
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
const node = (id: string, x: number, y: number, ref: string | null = null) =>
  ({
    id,
    layer: "overworld",
    x,
    y,
    kind: "grace",
    label: "",
    ref,
  }) satisfies MapNode;
const doc = (...nodes: MapNode[]): MapDocument => ({
  schemaVersion: 1,
  nodes,
  edges: [],
});

describe("grace import", () => {
  const graces = [
    grace(1, 100, 100),
    grace(2, 500, 500),
    grace(3, 900, 900),
    grace(4, 50, 50, "Underground", "underground"),
  ];

  it("adds the layer's graces, links hand-placed ones and skips linked ones", () => {
    const start = doc(
      node("hand", 120, 110),
      node("done", 900, 900, "grace/3"),
    );
    const result = applyMapAction(
      start,
      importGraces(graces, start, "overworld"),
    );
    expect(validDocument("map", result)).toBe(true);
    expect(result.nodes.find((n) => n.id === "hand")).toMatchObject({
      x: 120,
      y: 110,
      ref: "grace/1",
    });
    expect(result.nodes.map((n) => n.ref).sort()).toEqual([
      "grace/1",
      "grace/2",
      "grace/3",
    ]);
    expect(result.nodes.find((n) => n.ref === "grace/2")).toMatchObject({
      x: 500,
      y: 500,
      layer: "overworld",
      kind: "grace",
    });
  });

  it("is one undo step and has nothing left to do afterwards", () => {
    const start = doc();
    const history = historyReducer(
      { past: [], present: start, future: [] },
      importGraces(graces, start, "overworld"),
    );
    expect(history.present.nodes).toHaveLength(3);
    expect(historyReducer(history, { type: "undo" }).present).toBe(start);
    expect(importGraces(graces, history.present, "overworld")).toEqual({
      type: "batch",
      actions: [],
    });
  });

  it("leaves out a grace with the same name and spot as one already placed", () => {
    const twins = [
      grace(10, 300, 300, "Elden Throne"),
      grace(11, 301, 300, "Elden Throne"),
    ];
    const result = applyMapAction(
      doc(),
      importGraces(twins, doc(), "overworld"),
    );
    expect(result.nodes.map((n) => n.ref)).toEqual(["grace/10"]);
  });
});
