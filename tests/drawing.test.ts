import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode, Point } from "../src/domain/types";
import { drawTo, dropJunction, type Draft } from "../src/map/drawing";
import { applyMapAction } from "../src/map/editing";
import { validDocument } from "../src/storage/schema";

const empty: MapDocument = { schemaVersion: 3, nodes: [], edges: [] };
const find = (doc: MapDocument, id?: string) =>
  doc.nodes.find((n) => n.id === id);

/** Click the map at each point in Draw path mode, from `start`. */
function clicks(
  points: Point[],
  layers: MapNode["layer"][] = [],
  start: { doc: MapDocument; draft: Draft | null } = {
    doc: empty,
    draft: null,
  },
) {
  let { doc, draft } = start;
  points.forEach((point, i) => {
    const layer = layers[i] ?? "overworld";
    const next = dropJunction(draft, find(doc, draft?.from), layer, point);
    doc = applyMapAction(doc, next.action);
    draft = next.draft;
  });
  return { doc, draft };
}

describe("drawing a path through pins", () => {
  it("makes one path of every click until Esc", () => {
    const { doc } = clicks([
      [0, 0],
      [10, 0],
      [10, 10],
      [20, 10],
    ]);
    expect(doc.nodes.map((n) => [n.kind, n.x, n.y])).toEqual([
      ["junction", 0, 0],
      ["junction", 10, 0],
      ["junction", 10, 10],
      ["junction", 20, 10],
    ]);
    expect(doc.edges).toHaveLength(1);
    expect(doc.edges[0]).toMatchObject({
      nodes: doc.nodes.map((n) => n.id),
      step: 1,
    });
    expect(validDocument("map", doc)).toBe(true);
  });

  it("takes the path through an existing pin and goes on", () => {
    const grace: MapNode = {
      id: "j",
      layer: "overworld",
      x: 5,
      y: 5,
      kind: "junction",
      label: "",
      ref: null,
    };
    let state = clicks([[0, 0]], [], {
      doc: { ...empty, nodes: [grace] },
      draft: null,
    });
    const through = drawTo(
      state.draft,
      find(state.doc, state.draft?.from),
      grace,
    );
    state = {
      doc: applyMapAction(state.doc, through.action!),
      draft: through.draft,
    };
    state = clicks([[9, 9]], [], state);
    expect(state.doc.edges).toHaveLength(1);
    expect(state.doc.edges[0].nodes).toHaveLength(3);
    expect(state.doc.edges[0].nodes[1]).toBe("j");
  });

  it("starts a new path after Esc, numbered next", () => {
    const first = clicks([
      [0, 0],
      [10, 0],
    ]);
    // Esc ends the path: drawing starts again with no draft.
    const { doc } = clicks(
      [
        [10, 0],
        [20, 0],
      ],
      [],
      { doc: first.doc, draft: null },
    );
    expect(doc.edges.map((e) => [e.nodes.length, e.step])).toEqual([
      [2, 1],
      [2, 2],
    ]);
  });

  it("jumps to another layer as a teleport, then draws on as a new path", () => {
    const { doc } = clicks(
      [
        [0, 0],
        [5, 0],
        [10, 0],
        [20, 0],
      ],
      ["overworld", "overworld", "underground", "underground"],
    );
    expect(doc.nodes).toHaveLength(4);
    expect(doc.edges.map((e) => [e.nodes.length, e.teleport])).toEqual([
      [2, false],
      [2, true],
      [2, false],
    ]);
    expect(validDocument("map", doc)).toBe(true);
  });
});
