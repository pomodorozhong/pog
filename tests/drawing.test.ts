import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode, Point } from "../src/domain/types";
import { dropJunction } from "../src/map/drawing";
import { applyMapAction } from "../src/map/editing";
import { validDocument } from "../src/storage/schema";

const empty: MapDocument = { schemaVersion: 2, nodes: [], edges: [] };

/** Click the map at each point in Draw path mode, starting with nothing drawn. */
function clicks(points: Point[], layers: MapNode["layer"][] = []) {
  let doc = empty;
  let from: string | null = null;
  points.forEach((point, i) => {
    const node = doc.nodes.find((n) => n.id === from);
    const layer = layers[i] ?? "overworld";
    const { action, next } = dropJunction(node, layer, point, "road");
    doc = applyMapAction(doc, action);
    from = next;
  });
  return doc;
}

describe("drawing paths by dropping junctions", () => {
  it("ends a path at each click and starts the next one there", () => {
    const doc = clicks([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(doc.nodes.map((n) => [n.kind, n.x, n.y])).toEqual([
      ["junction", 0, 0],
      ["junction", 10, 0],
      ["junction", 10, 10],
    ]);
    const [a, b, c] = doc.nodes.map((n) => n.id);
    expect(doc.edges.map((e) => [e.from, e.to, e.step, e.points])).toEqual([
      [a, b, 1, []],
      [b, c, 2, []],
    ]);
    expect(validDocument("map", doc)).toBe(true);
  });

  it("is one undo step per click", () => {
    const first = clicks([[0, 0]]);
    const { action } = dropJunction(
      first.nodes[0],
      "overworld",
      [5, 5],
      "road",
    );
    expect(action).toMatchObject({ type: "batch" });
  });

  it("starts afresh on another layer", () => {
    const doc = clicks(
      [
        [0, 0],
        [10, 0],
      ],
      ["overworld", "underground"],
    );
    expect(doc.nodes).toHaveLength(2);
    expect(doc.edges).toEqual([]);
  });
});
