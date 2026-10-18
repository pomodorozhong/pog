import { describe, expect, it } from "vitest";
import { activeProfile, addProfile, TEMPLATES } from "../src/profiles/profiles";
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";
import {
  addToWishlist,
  combinedWishlist,
  countByStatus,
  removeFromWishlist,
  updateWishlistItem,
  walkOrder,
} from "../src/wishlist/wishlist";
import type {
  MapDocument,
  MapEdge,
  MapNode,
  WishlistItem,
} from "../src/domain/types";
import { drawn } from "./paths";

const STARS = "weapon/11050000";

describe("wishlist", () => {
  it("adds, updates and removes items on one profile", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const added = addToWishlist(start, id, STARS);
    expect(activeProfile(added).wishlist).toEqual([
      { item: STARS, status: "needed", note: "" },
    ]);
    // Adding again keeps the existing entry.
    const marked = updateWishlistItem(added, id, STARS, {
      status: "acquired",
      note: "Altus carriage",
    });
    expect(addToWishlist(marked, id, STARS)).toEqual(marked);
    expect(validDocument("player", marked)).toBe(true);
    expect(countByStatus(activeProfile(marked).wishlist)).toEqual({
      needed: 0,
      acquired: 1,
      skipped: 0,
    });
    expect(
      activeProfile(removeFromWishlist(marked, id, STARS)).wishlist,
    ).toEqual([]);
  });

  it("rejects duplicate items and unknown statuses", () => {
    const player = initialDocuments().player;
    const withWishlist = (wishlist: unknown[]) => ({
      ...player,
      profiles: [{ ...player.profiles[0], wishlist }],
    });
    const entry = { item: STARS, status: "needed", note: "" };
    expect(validDocument("player", withWishlist([entry, entry]))).toBe(false);
    expect(
      validDocument("player", withWishlist([{ ...entry, status: "wanted" }])),
    ).toBe(false);
  });

  it("gives version 2 profiles an empty wishlist", () => {
    const player = initialDocuments().player;
    const v2 = {
      ...player,
      schemaVersion: 4,
      profiles: [{ id: "profile-1", name: "", goal: "", constraints: "" }],
    };
    expect(upgradeDocument("player", v2)).toEqual(initialDocuments().player);
  });
});

describe("playthrough templates", () => {
  it("starts the Great Stars Guard Counter playthrough with its wishlist", () => {
    const player = addProfile(initialDocuments().player, TEMPLATES[0]);
    const profile = activeProfile(player);
    expect(profile.name).toBe("Great Stars Guard Counter");
    expect(countByStatus(profile.wishlist)).toEqual({
      needed: 41,
      acquired: 5,
      skipped: 0,
    });
    expect(validDocument("player", player)).toBe(true);
    // Each new profile gets its own copy.
    expect(profile.wishlist).not.toBe(TEMPLATES[0].wishlist);
  });
});

describe("walk order", () => {
  const pin = (
    id: string,
    ref: string | null,
    kind: MapNode["kind"] = "item",
  ): MapNode => ({
    id,
    layer: "overworld",
    x: 0,
    y: 0,
    kind,
    label: "",
    ref,
  });
  const want = (item: string): WishlistItem => ({
    item,
    status: "needed",
    note: "",
  });

  it("sorts items by the lowest step of a path through their pin", () => {
    const map: MapDocument = {
      schemaVersion: 4,
      nodes: [
        pin("a", "weapon/a"),
        pin("b", "weapon/b"),
        pin("b2", "weapon/b"),
        pin("c", "weapon/c"),
        pin("j", null, "junction"),
      ],
      edges: [
        { ...drawn("e1", ["j", "b2"]), step: 1 },
        { ...drawn("e2", ["b2", "a"]), step: 2 },
        { ...drawn("e3", ["a", "b"]), step: 3 },
      ],
    };
    const wishlist = ["weapon/a", "weapon/c", "weapon/b", "weapon/d"].map(want);
    const { onRoute, offRoute } = walkOrder(map, wishlist);
    // weapon/b has two pins; the one reached first counts.
    expect(onRoute.map((r) => [r.entry.item, r.pin, r.step])).toEqual([
      ["weapon/b", "b2", 1],
      ["weapon/a", "a", 2],
    ]);
    // A pin on no path keeps its pin; an item with no pin has none.
    expect(offRoute.map((r) => [r.entry.item, r.pin])).toEqual([
      ["weapon/c", "c"],
      ["weapon/d", null],
    ]);
  });
});

describe("items on a walked path", () => {
  const node = (id: string, items?: string[]): MapNode => ({
    id,
    layer: "overworld",
    x: 0,
    y: 0,
    kind: id.startsWith("grace/") ? "grace" : "junction",
    label: "",
    ref: id.startsWith("grace/") ? id : null,
    ...(items && { items }),
  });
  const path = (id: string, nodes: string[], step: number | null): MapEdge => ({
    ...drawn(id, nodes),
    step,
  });
  const map = (edges: MapEdge[], nodes = [node("a", ["weapon/a"])]) => ({
    schemaVersion: 4 as const,
    nodes: [...nodes, node("b"), node("c", ["weapon/c"])],
    edges,
  });
  const joined = (item: string) => ({
    item,
    status: "needed",
    note: "",
    joined: true,
  });

  it("join the wishlist as needed, in step order, after saved items", () => {
    const saved: WishlistItem[] = [
      { item: "weapon/x", status: "needed", note: "" },
    ];
    const walked = map([path("e2", ["b", "a"], 2), path("e1", ["c", "b"], 1)]);
    expect(combinedWishlist(walked, saved)).toEqual([
      saved[0],
      joined("weapon/c"),
      joined("weapon/a"),
    ]);
    // A grace's items join too, and an item on two pins joins once.
    const grace = node("grace/1", ["weapon/g", "weapon/a"]);
    expect(
      combinedWishlist(
        map(
          [path("e1", ["a", "grace/1"], 1)],
          [node("a", ["weapon/a"]), grace],
        ),
        [],
      ),
    ).toEqual([joined("weapon/a"), joined("weapon/g")]);
  });

  it("leave when no walked path reaches their pin", () => {
    // No path, a note path, or a path split away from the pin.
    expect(combinedWishlist(map([]), [])).toEqual([]);
    expect(combinedWishlist(map([path("n", ["a"], null)]), [])).toEqual([]);
    expect(combinedWishlist(map([path("e1", ["b", "c"], 1)]), [])).toEqual([
      joined("weapon/c"),
    ]);
    // The item taken off the pin.
    expect(
      combinedWishlist(map([path("e1", ["a", "b"], 1)], [node("a", [])]), []),
    ).toEqual([]);
  });

  it("stay once changed or added by hand, and are only saved then", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const walked = map([path("e1", ["a", "c"], 1)]);
    const noted = updateWishlistItem(start, id, "weapon/a", {
      note: "behind the chest",
    });
    const skipped = updateWishlistItem(noted, id, "weapon/c", {
      status: "skipped",
    });
    expect(activeProfile(start).wishlist).toEqual([]);
    expect(activeProfile(skipped).wishlist).toEqual([
      { item: "weapon/a", status: "needed", note: "behind the chest" },
      { item: "weapon/c", status: "skipped", note: "" },
    ]);
    expect(combinedWishlist(walked, activeProfile(skipped).wishlist)).toEqual(
      activeProfile(skipped).wishlist,
    );
    // With the path gone, changed items and items added by hand stay.
    const byHand = addToWishlist(skipped, id, "weapon/x");
    expect(
      combinedWishlist(map([]), activeProfile(byHand).wishlist).map(
        (w) => w.item,
      ),
    ).toEqual(["weapon/a", "weapon/c", "weapon/x"]);
  });
});
