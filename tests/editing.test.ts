import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode } from "../src/domain/types";
import { applyMapAction, historyReducer } from "../src/map/editing";
import { validDocument } from "../src/storage/schema";

const node = (id: string, layer: MapNode["layer"] = "overworld"): MapNode => ({
  id,
  layer,
  x: 1,
  y: 2,
  kind: "junction",
  label: "",
  ref: null,
});
const doc = (...nodes: MapNode[]): MapDocument => ({
  schemaVersion: 1,
  nodes,
  edges: [],
});
const edge = (
  id: string,
  from: string,
  to: string,
  type: "road" | "waygate" = "road",
) => ({
  id,
  from,
  to,
  type,
  points: [[5, 5]] as [number, number][],
  note: "",
});

describe("map editing", () => {
  it("joins layers only with waygates, which carry no waypoints", () => {
    const start = doc(node("a"), node("b", "underground"));
    expect(
      applyMapAction(start, { type: "addEdge", edge: edge("e", "a", "b") }),
    ).toBe(start);
    const linked = applyMapAction(start, {
      type: "addEdge",
      edge: edge("e", "a", "b", "waygate"),
    });
    expect(linked.edges).toEqual([
      { ...edge("e", "a", "b", "waygate"), points: [] },
    ]);
    expect(validDocument("map", linked)).toBe(true);
    expect(
      applyMapAction(linked, {
        type: "updateEdge",
        id: "e",
        changes: { type: "road" },
      }),
    ).toBe(linked);
  });

  it("removes a node's paths with it and keeps nodes on their path's layer", () => {
    const linked = applyMapAction(doc(node("a"), node("b")), {
      type: "addEdge",
      edge: edge("e", "a", "b"),
    });
    expect(
      applyMapAction(linked, {
        type: "updateNode",
        id: "a",
        changes: { layer: "dlc" },
      }),
    ).toBe(linked);
    expect(applyMapAction(linked, { type: "removeNode", id: "a" })).toEqual(
      doc(node("b")),
    );
  });

  it("undoes and redoes, and ignores edits that change nothing", () => {
    let history = historyReducer(
      { past: [], present: doc(), future: [] },
      { type: "addNode", node: node("a") },
    );
    history = historyReducer(history, {
      type: "updateNode",
      id: "a",
      changes: { x: 9 },
    });
    expect(historyReducer(history, { type: "removeEdge", id: "missing" })).toBe(
      history,
    );
    history = historyReducer(history, { type: "undo" });
    expect(history.present.nodes[0].x).toBe(1);
    history = historyReducer(history, { type: "redo" });
    expect(history.present.nodes[0].x).toBe(9);
    history = historyReducer(historyReducer(history, { type: "undo" }), {
      type: "addNode",
      node: node("b"),
    });
    expect(history.future).toEqual([]);
  });
});

describe("document validation", () => {
  it("rejects dangling, duplicate and malformed entries", () => {
    const base = doc(node("a"), node("b"));
    expect(
      validDocument("map", { ...base, edges: [edge("e", "a", "missing")] }),
    ).toBe(false);
    expect(validDocument("map", doc(node("a"), node("a")))).toBe(false);
    expect(
      validDocument("map", {
        ...base,
        edges: [edge("e", "a", "b"), edge("e", "b", "a")],
      }),
    ).toBe(false);
    expect(validDocument("map", doc({ ...node("a"), x: Number.NaN }))).toBe(
      false,
    );
    expect(validDocument("map", { ...base, extra: true })).toBe(false);
    expect(
      validDocument("player", {
        schemaVersion: 1,
        language: "zh-TW",
        view: { layer: "dlc", x: 1, y: 2, zoom: 3 },
      }),
    ).toBe(true);
    expect(
      validDocument("player", {
        schemaVersion: 1,
        language: "fr",
        view: { layer: "dlc", x: 1, y: 2, zoom: 3 },
      }),
    ).toBe(false);
  });
});
