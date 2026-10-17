import { describe, expect, it } from "vitest";
import { activeProfile, addProfile, TEMPLATES } from "../src/profiles/profiles";
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";
import {
  addToWishlist,
  countByStatus,
  removeFromWishlist,
  updateWishlistItem,
  walkOrder,
} from "../src/wishlist/wishlist";
import type { MapDocument, MapNode, WishlistItem } from "../src/domain/types";
import { newPath } from "../src/map/editing";

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
      schemaVersion: 3,
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
      schemaVersion: 3,
      nodes: [
        pin("a", "weapon/a"),
        pin("b", "weapon/b"),
        pin("b2", "weapon/b"),
        pin("c", "weapon/c"),
        pin("j", null, "junction"),
      ],
      edges: [
        { ...newPath("e1", ["j", "b2"]), step: 1 },
        { ...newPath("e2", ["b2", "a"]), step: 2 },
        { ...newPath("e3", ["a", "b"]), step: 3 },
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
