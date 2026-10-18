import { describe, expect, it } from "vitest";
import { activeProfile, addProfile, TEMPLATES } from "../src/profiles/profiles";
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";
import {
  addToWishlist,
  attachToPin,
  combinedWishlist,
  countByStatus,
  removeFromWishlist,
  strandedEntries,
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
  it("adds, updates and removes entries on one profile", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const added = addToWishlist(start, id, STARS);
    expect(activeProfile(added).wishlist).toEqual([
      { item: STARS, status: "needed", note: "" },
    ]);
    // Adding again keeps the existing entry.
    const marked = updateWishlistItem(added, id, STARS, null, {
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
      activeProfile(removeFromWishlist(marked, id, STARS, null)).wishlist,
    ).toEqual([]);
  });

  it("keeps an entry per pin, each with its own status", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const both = addToWishlist(
      addToWishlist(addToWishlist(start, id, STARS, "a"), id, STARS, "b"),
      id,
      STARS,
    );
    const marked = updateWishlistItem(both, id, STARS, "b", {
      status: "acquired",
    });
    expect(activeProfile(marked).wishlist).toEqual([
      { item: STARS, pin: "a", status: "needed", note: "" },
      { item: STARS, pin: "b", status: "acquired", note: "" },
      { item: STARS, status: "needed", note: "" },
    ]);
    expect(validDocument("player", marked)).toBe(true);
    expect(
      activeProfile(removeFromWishlist(marked, id, STARS, "a")).wishlist,
    ).toEqual(activeProfile(marked).wishlist.slice(1));
  });

  it("rejects duplicate entries and unknown statuses", () => {
    const player = initialDocuments().player;
    const withWishlist = (wishlist: unknown[]) => ({
      ...player,
      profiles: [{ ...player.profiles[0], wishlist }],
    });
    const entry = { item: STARS, status: "needed", note: "" };
    const atPin = { ...entry, pin: "a" };
    expect(validDocument("player", withWishlist([entry, entry]))).toBe(false);
    expect(validDocument("player", withWishlist([atPin, atPin]))).toBe(false);
    // Saved before entries had pins, or one at a pin and one without.
    expect(validDocument("player", withWishlist([entry, atPin]))).toBe(true);
    expect(
      validDocument("player", withWishlist([{ ...entry, status: "wanted" }])),
    ).toBe(false);
    expect(validDocument("player", withWishlist([{ ...entry, pin: 1 }]))).toBe(
      false,
    );
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
  const want = (item: string, pin?: string): WishlistItem => ({
    item,
    ...(pin && { pin }),
    status: "needed",
    note: "",
  });

  it("sorts each pin's entry by the lowest step of a path through it", () => {
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
    const { pinned, unpinned } = combinedWishlist(map, [
      want("weapon/a", "a"),
      want("weapon/c", "c"),
      want("weapon/b", "b"),
      want("weapon/d"),
    ]);
    const { onRoute, offRoute } = walkOrder(map, pinned);
    // weapon/b has two pins, each with its own row; b2 joins from its path.
    expect(onRoute.map((r) => [r.entry.item, r.pin, r.step])).toEqual([
      ["weapon/b", "b2", 1],
      ["weapon/a", "a", 2],
      ["weapon/b", "b", 3],
    ]);
    // A pin on no path keeps its pin; an entry with no pin isn't in the walk.
    expect(offRoute.map((r) => [r.entry.item, r.pin])).toEqual([
      ["weapon/c", "c"],
    ]);
    expect(unpinned).toEqual([want("weapon/d")]);
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
  const joined = (item: string, pin: string) => ({
    item,
    pin,
    status: "needed",
    note: "",
    joined: true,
  });

  it("join the wishlist as needed, per pin, in step order, after saved items", () => {
    const saved: WishlistItem[] = [
      { item: "weapon/c", pin: "c", status: "skipped", note: "" },
    ];
    const walked = map([path("e2", ["b", "a"], 2), path("e1", ["c", "b"], 1)]);
    expect(combinedWishlist(walked, saved).pinned).toEqual([
      saved[0],
      joined("weapon/a", "a"),
    ]);
    // A grace's items join too, and an item on two pins joins at each.
    const grace = node("grace/1", ["weapon/g", "weapon/a"]);
    expect(
      combinedWishlist(
        map(
          [path("e1", ["a", "grace/1"], 1)],
          [node("a", ["weapon/a"]), grace],
        ),
        [],
      ).pinned,
    ).toEqual([
      joined("weapon/a", "a"),
      joined("weapon/g", "grace/1"),
      joined("weapon/a", "grace/1"),
    ]);
  });

  it("leave when no walked path reaches their pin", () => {
    const pinned = (doc: MapDocument) => combinedWishlist(doc, []).pinned;
    // No path, a note path, or a path split away from the pin.
    expect(pinned(map([]))).toEqual([]);
    expect(pinned(map([path("n", ["a"], null)]))).toEqual([]);
    expect(pinned(map([path("e1", ["b", "c"], 1)]))).toEqual([
      joined("weapon/c", "c"),
    ]);
    // The item taken off the pin.
    expect(pinned(map([path("e1", ["a", "b"], 1)], [node("a", [])]))).toEqual(
      [],
    );
  });

  it("stay once changed, and are only saved then", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const walked = map([path("e1", ["a", "c"], 1)]);
    const noted = updateWishlistItem(start, id, "weapon/a", "a", {
      note: "behind the chest",
    });
    const skipped = updateWishlistItem(noted, id, "weapon/c", "c", {
      status: "skipped",
    });
    expect(activeProfile(start).wishlist).toEqual([]);
    expect(activeProfile(skipped).wishlist).toEqual([
      {
        item: "weapon/a",
        pin: "a",
        status: "needed",
        note: "behind the chest",
      },
      { item: "weapon/c", pin: "c", status: "skipped", note: "" },
    ]);
    expect(
      combinedWishlist(walked, activeProfile(skipped).wishlist).pinned,
    ).toEqual(activeProfile(skipped).wishlist);
    // With the path gone, changed entries stay at their pins.
    expect(
      combinedWishlist(map([]), activeProfile(skipped).wishlist).pinned,
    ).toEqual(activeProfile(skipped).wishlist);
  });
});

describe("entries not attached to a pin", () => {
  const node = (id: string, items: string[]): MapNode => ({
    id,
    layer: "overworld",
    x: 0,
    y: 0,
    kind: "junction",
    label: "",
    ref: null,
    items,
  });
  const doc = (nodes: MapNode[], walked = false): MapDocument => ({
    schemaVersion: 4,
    nodes,
    edges: walked
      ? [
          {
            ...drawn(
              "e1",
              nodes.map((n) => n.id),
            ),
            step: 1,
          },
        ]
      : [],
  });
  const seed: WishlistItem = { item: "seed", status: "skipped", note: "x" };

  it("include entries whose pin is gone or no longer holds the item", () => {
    const atA = { ...seed, pin: "a" };
    const saved = [atA, seed];
    expect(combinedWishlist(doc([node("a", ["seed"])]), saved)).toEqual({
      pinned: [atA],
      unpinned: [seed],
    });
    // The pin deleted, or the item taken off it: the entry keeps its pin,
    // so undoing either brings it back.
    for (const map of [doc([]), doc([node("a", [])])])
      expect(combinedWishlist(map, saved)).toEqual({
        pinned: [],
        unpinned: [atA, seed],
      });
  });

  it("attach to a pin with their status and note", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const saved = addToWishlist(start, id, "seed");
    const attached = attachToPin(
      saved,
      id,
      activeProfile(saved).wishlist[0],
      "b",
    );
    expect(activeProfile(attached).wishlist).toEqual([
      { item: "seed", pin: "b", status: "needed", note: "" },
    ]);
  });

  it("are flagged when a pin holds their item, as old saved wishlists are", () => {
    const map = doc([node("a", ["seed"])], true);
    const { pinned, unpinned } = combinedWishlist(map, [seed]);
    // The pin joins on its own, so the saved status isn't on it.
    expect(pinned).toEqual([
      { item: "seed", pin: "a", status: "needed", note: "", joined: true },
    ]);
    expect(strandedEntries(map, unpinned)).toEqual([seed]);
    expect(strandedEntries(doc([]), unpinned)).toEqual([]);
  });
});
