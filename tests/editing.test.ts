import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode } from "../src/domain/types";
import { applyMapAction, historyReducer } from "../src/map/editing";
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";

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
  schemaVersion: 2,
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
      { ...edge("e", "a", "b", "waygate"), points: [], step: 1 },
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

describe("path steps", () => {
  const add = (start: MapDocument, ...ids: string[]) =>
    ids.reduce(
      (next, id) =>
        applyMapAction(next, {
          type: "addEdge",
          edge: edge(id, "a", id === "c" ? "c" : "b"),
        }),
      start,
    );
  const order = (map: MapDocument) =>
    [...map.edges].sort((x, y) => x.step - y.step).map((e) => e.id);
  const steps = (map: MapDocument) =>
    Object.fromEntries(map.edges.map((e) => [e.id, e.step]));
  const four = add(doc(node("a"), node("b"), node("c")), "p", "q", "r", "s");

  it("numbers new paths after the last one", () => {
    expect(steps(four)).toEqual({ p: 1, q: 2, r: 3, s: 4 });
    expect(validDocument("map", four)).toBe(true);
  });

  it("moves a path to any step and shifts the ones between", () => {
    const move = (id: string, step: number) =>
      applyMapAction(four, { type: "moveEdge", id, step });
    expect(order(move("s", 2))).toEqual(["p", "s", "q", "r"]);
    expect(order(move("p", 3))).toEqual(["q", "r", "p", "s"]);
    expect(order(move("r", 1))).toEqual(["r", "p", "q", "s"]);
    expect(order(move("q", 99))).toEqual(["p", "r", "s", "q"]);
    expect(validDocument("map", move("s", 2))).toBe(true);
    expect(move("q", 2)).toBe(four);
    expect(move("missing", 1)).toBe(four);
  });

  it("closes the gap when a path or its node is removed", () => {
    const moved = applyMapAction(four, { type: "moveEdge", id: "s", step: 1 });
    expect(
      steps(applyMapAction(moved, { type: "removeEdge", id: "p" })),
    ).toEqual({ s: 1, q: 2, r: 3 });
    // c's path is step 2 here; removing c renumbers the rest.
    const withC = add(doc(node("a"), node("b"), node("c")), "p", "c", "q");
    expect(
      steps(applyMapAction(withC, { type: "removeNode", id: "c" })),
    ).toEqual({ p: 1, q: 2 });
  });

  it("rejects gaps and repeats, and numbers older maps in file order", () => {
    const at = (...s: number[]) => ({
      ...four,
      edges: four.edges.map((e, i) => ({ ...e, step: s[i] })),
    });
    expect(validDocument("map", at(4, 3, 2, 1))).toBe(true);
    expect(validDocument("map", at(1, 2, 2, 3))).toBe(false);
    expect(validDocument("map", at(1, 2, 3, 5))).toBe(false);
    expect(validDocument("map", at(0, 1, 2, 3))).toBe(false);
    const v1 = {
      schemaVersion: 1,
      nodes: four.nodes,
      edges: four.edges.map((e) => ({ ...e, step: undefined })),
    };
    expect(upgradeDocument("map", v1)).toEqual(four);
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
    const player = initialDocuments().player;
    expect(validDocument("player", { ...player, language: "zh-TW" })).toBe(
      true,
    );
    expect(validDocument("player", { ...player, language: "fr" })).toBe(false);
    expect(
      validDocument("player", { ...player, activeProfile: "missing" }),
    ).toBe(false);
    expect(validDocument("player", { ...player, profiles: [] })).toBe(false);
  });
});
