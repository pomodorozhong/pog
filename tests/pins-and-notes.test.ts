import { describe, expect, it } from "vitest";
import {
  entrancePlace,
  pinItems,
  type MapDocument,
  type MapEdge,
  type MapNode,
} from "../src/domain/types";
import {
  applyMapAction,
  newPath,
  notePath,
  type MapAction,
} from "../src/map/editing";
import { withGameGraces } from "../src/map/graces";
import { wishlistTargets } from "../src/routing/order";
import { validDocument } from "../src/storage/schema";
import { walkOrder } from "../src/wishlist/wishlist";
import { drawn } from "./paths";

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
const grace = node("grace/1", { kind: "grace", ref: "grace/1" });
const fixed = new Map([[grace.id, grace]]);
const doc = (...nodes: MapNode[]): MapDocument => ({
  schemaVersion: 4,
  nodes,
  edges: [],
});
const apply = (start: MapDocument, ...actions: MapAction[]) =>
  actions.reduce((next, action) => applyMapAction(next, action, fixed), start);
const walk = (id: string, nodes: string[]): MapAction => ({
  type: "addEdge",
  edge: drawn(id, nodes),
});
const note = (id: string, pin: string, text = "remember"): MapAction => ({
  type: "addEdge",
  edge: { ...newPath(id, [pin]), note: text },
});
const steps = (map: MapDocument) =>
  Object.fromEntries(map.edges.map((e) => [e.id, e.step]));

describe("note paths", () => {
  it("gives any pin, a game grace too, one note path with no step", () => {
    const map = apply(
      doc(node("a"), node("b")),
      note("na", "a"),
      note("ng", "grace/1"),
      walk("p", ["a", "b"]),
      // A pin has at most one note.
      note("again", "a"),
    );
    expect(steps(map)).toEqual({ na: null, ng: null, p: 1 });
    expect(notePath(map, "a")?.note).toBe("remember");
    expect(notePath(map, "grace/1")?.id).toBe("ng");
    expect(notePath(map, "b")).toBeUndefined();
    expect(validDocument("map", map)).toBe(true);
  });

  it("numbers, moves and splits only the walked paths", () => {
    const start = apply(
      doc(node("a"), node("b"), node("c")),
      walk("p", ["a", "b"]),
      note("n", "b"),
      walk("q", ["b", "c", "a"]),
    );
    expect(steps(start)).toEqual({ p: 1, n: null, q: 2 });
    const moved = apply(start, { type: "moveEdge", id: "q", step: 1 });
    expect(steps(moved)).toEqual({ q: 1, p: 2, n: null });
    const split = apply(moved, {
      type: "splitEdge",
      id: "q",
      at: 1,
      newId: "r",
    });
    expect(steps(split)).toEqual({ q: 1, r: 2, p: 3, n: null });
    const removed = apply(split, { type: "removeEdge", id: "q" });
    expect(steps(removed)).toEqual({ r: 1, p: 2, n: null });
    // A note path can't be moved, split or extended.
    expect(apply(removed, { type: "moveEdge", id: "n", step: 1 })).toBe(
      removed,
    );
    expect(apply(removed, { type: "extendEdge", id: "n", node: "a" })).toBe(
      removed,
    );
    expect(validDocument("map", removed)).toBe(true);
  });

  it("goes with its pin, and a walked path left with one pin never becomes one", () => {
    const start = apply(
      doc(node("a"), node("b")),
      walk("p", ["a", "b"]),
      note("na", "a"),
      note("nb", "b"),
    );
    const removed = apply(start, { type: "removeNode", id: "a" });
    expect(removed.edges.map((e) => e.id)).toEqual(["nb"]);
    expect(validDocument("map", removed)).toBe(true);
  });

  it("is checked when loading", () => {
    const base: MapDocument = { ...doc(node("a"), node("b")) };
    const with_ = (...edges: MapEdge[]) => ({ ...base, edges });
    const one = { ...newPath("n", ["a"]), color: "gold" as const };
    expect(validDocument("map", with_({ ...one, step: null }))).toBe(true);
    expect(validDocument("map", with_({ ...one, step: 1 }))).toBe(false);
    expect(
      validDocument("map", with_({ ...drawn("p", ["a", "b"]), step: null })),
    ).toBe(false);
    expect(
      validDocument(
        "map",
        with_({ ...one, step: null }, { ...one, id: "m", step: null }),
      ),
    ).toBe(false);
    // Walked steps count only walked paths.
    expect(
      validDocument(
        "map",
        with_({ ...one, step: null }, { ...drawn("p", ["a", "b"]), step: 2 }),
      ),
    ).toBe(false);
  });
});

describe("items on pins", () => {
  it("reads an item list, or an older map's item pin, and checks the list", () => {
    expect(pinItems(node("a", { items: ["weapon/1", "weapon/2"] }))).toEqual([
      "weapon/1",
      "weapon/2",
    ]);
    expect(pinItems(node("old", { kind: "item", ref: "weapon/3" }))).toEqual([
      "weapon/3",
    ]);
    expect(pinItems(node("j"))).toEqual([]);
    const map = (items: unknown) => ({
      ...doc(node("a", { kind: "entrance", items: items as string[] })),
    });
    expect(validDocument("map", map(["weapon/1"]))).toBe(true);
    expect(validDocument("map", map(["weapon/1", "weapon/1"]))).toBe(false);
    expect(validDocument("map", map([1]))).toBe(false);
  });

  it("finds wishlist items on any pin for the walk order and route", () => {
    const map = apply(
      doc(
        node("j"),
        node("cave", { kind: "entrance", items: ["weapon/1", "weapon/2"] }),
        node("old", { kind: "item", ref: "weapon/3" }),
      ),
      walk("p", ["j", "cave"]),
      note("n", "old"),
    );
    const wishlist = ["weapon/2", "weapon/3"].map((item) => ({
      item,
      status: "needed" as const,
      note: "",
    }));
    const { onRoute, offRoute } = walkOrder(map, wishlist);
    expect(onRoute.map((r) => [r.entry.item, r.pin, r.step])).toEqual([
      ["weapon/2", "cave", 1],
    ]);
    // A note path isn't a walk, so the old pin stays off the route.
    expect(offRoute.map((r) => [r.entry.item, r.pin])).toEqual([
      ["weapon/3", "old"],
    ]);
    expect(wishlistTargets(map, wishlist)).toEqual([
      { item: "weapon/2", node: "cave" },
      { item: "weapon/3", node: "old" },
    ]);
  });
});

describe("graces that work like pins", () => {
  const set = (changes: Partial<MapNode>): MapAction => ({
    type: "updateNode",
    id: "grace/1",
    changes,
  });
  const shown = (map: MapDocument) =>
    withGameGraces(map, [grace]).nodes.find((n) => n.id === "grace/1")!;

  it("stores only what was added, and drops it once cleared", () => {
    const map = apply(
      doc(),
      set({ label: "boss first", items: ["weapon/1"] }),
      set({ place: "place/7" }),
      // A grace can't move or change kind.
      set({ x: 9, kind: "junction" }),
    );
    expect(map.nodes).toEqual([]);
    expect(map.graces).toEqual({
      "grace/1": { label: "boss first", items: ["weapon/1"], place: "place/7" },
    });
    expect(validDocument("map", map)).toBe(true);
    expect(shown(map)).toMatchObject({
      kind: "grace",
      ref: "grace/1",
      x: 1,
      label: "boss first",
      place: "place/7",
      items: ["weapon/1"],
    });
    expect(entrancePlace(shown(map))).toBe("place/7");

    const cleared = apply(map, set({ label: "", place: "", items: [] }));
    expect(cleared).not.toHaveProperty("graces");
    // Only game graces have details.
    const other: MapAction = {
      type: "updateNode",
      id: "grace/9",
      changes: { label: "x" },
    };
    expect(apply(doc(), other)).toEqual(doc());
  });

  it("is checked when loading", () => {
    const map = (graces: unknown) => ({ ...doc(), graces });
    expect(validDocument("map", map({ "grace/1": { items: ["a"] } }))).toBe(
      true,
    );
    expect(validDocument("map", map({ j: { label: "x" } }))).toBe(false);
    expect(validDocument("map", map({ "grace/1": { kind: "x" } }))).toBe(false);
    expect(
      validDocument("map", map({ "grace/1": { items: ["a", "a"] } })),
    ).toBe(false);
    expect(validDocument("map", map([]))).toBe(false);
  });

  it("finds wishlist items at a grace for the walk order and route", () => {
    const map = withGameGraces(
      apply(
        doc(node("j")),
        set({ items: ["weapon/1"] }),
        walk("p", ["j", "grace/1"]),
      ),
      [grace],
    );
    const wishlist = [
      { item: "weapon/1", status: "needed" as const, note: "" },
    ];
    expect(
      walkOrder(map, wishlist).onRoute.map((r) => [r.pin, r.step]),
    ).toEqual([["grace/1", 1]]);
    expect(wishlistTargets(map, wishlist)).toEqual([
      { item: "weapon/1", node: "grace/1" },
    ]);
  });
});
