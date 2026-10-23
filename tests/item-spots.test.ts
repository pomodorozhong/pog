import { describe, expect, it } from "vitest";
import type {
  ItemSpotMode,
  MapDocument,
  WishlistItem,
} from "../src/domain/types";
import { translate } from "../src/i18n/translation";
import type { CatalogPickup, GameData } from "../src/map/catalog";
import {
  pinAtSpot,
  shownSpots,
  spotsOfItem,
  wishedItems,
} from "../src/map/itemSpots";

const SEED = "goods/10010";
const TEAR = "goods/10020";
const RUNE = "goods/2900";
const spot = (lot: number, items: string[], flag: number | null = lot) =>
  ({
    lot,
    flag,
    items,
    layer: "overworld",
    x: lot * 100,
    y: 0,
    legacy: false,
  }) as CatalogPickup;
const seed = spot(1, [SEED]);
const both = spot(2, [RUNE, TEAR]);
const rune = spot(3, [RUNE], null);
const pickups = [seed, both, rune];
const byItem = new Map<string, CatalogPickup[]>();
for (const p of pickups)
  for (const item of p.items)
    byItem.set(item, [...(byItem.get(item) ?? []), p]);
const name = (en: string) => ({ en, "zh-TW": `${en} (zh)` });
const data = {
  catalog: { pickups },
  byId: new Map([
    [SEED, { id: SEED, name: name("Golden Seed") }],
    [TEAR, { id: TEAR, name: name("Sacred Tear") }],
    [RUNE, { id: RUNE, name: name("Golden Rune") }],
  ]),
  pickupsByItem: byItem,
} as unknown as GameData;
const t = (key: string) => translate("en", key);
const map = (pinItems: string[] = []): MapDocument => ({
  schemaVersion: 4,
  nodes: [
    {
      id: "pin",
      layer: "overworld",
      x: 0,
      y: 0,
      kind: "junction",
      label: "",
      ref: null,
      items: pinItems,
    },
  ],
  edges: pinItems.length
    ? [
        {
          id: "walk",
          nodes: ["pin", "pin2"],
          color: "gold",
          line: "solid",
          oneWay: false,
          note: "",
          showNote: false,
          step: 1,
        },
      ]
    : [],
});
const entry = (item: string, status: WishlistItem["status"] = "needed") => ({
  item,
  status,
  note: "",
});
const show = (
  mode: ItemSpotMode,
  wishlist: WishlistItem[] = [],
  doc = map(),
  flags: number[] = [],
  language: "en" | "zh-TW" = "en",
) => shownSpots(t, data, language, mode, wishedItems(doc, wishlist), flags);

describe("the item spots shown on the map", () => {
  it("shows none when off, and every spot for All", () => {
    expect(show("off", [entry(SEED)])).toEqual([]);
    expect(show("all").map((s) => s.lot)).toEqual([1, 2, 3]);
  });

  it("shows only the wishlist's spots, joined entries too, skipped ones not", () => {
    const lots = (wishlist: WishlistItem[], doc = map()) =>
      show("wishlist", wishlist, doc).map((s) => s.lot);
    expect(lots([entry(TEAR)])).toEqual([2]);
    expect(lots([entry(TEAR, "skipped")])).toEqual([]);
    // A spot giving two wished items shows once.
    expect(lots([entry(TEAR), entry(RUNE)])).toEqual([2, 3]);
    expect(lots([], map([SEED]))).toEqual([1]);
    // The same items in another order are the same: the spots stay as they are.
    expect(wishedItems(map(), [entry(TEAR), entry(RUNE)])).toEqual(
      wishedItems(map(), [entry(RUNE), entry(TEAR), entry(RUNE)]),
    );
  });

  it("names every item, shows a wished one's icon and marks picked-up spots", () => {
    const [shown] = show("wishlist", [entry(TEAR)], map(), [2]);
    expect(shown).toMatchObject({
      picked: true,
      icon: TEAR,
      label: "Golden Rune · Sacred Tear · Picked up",
    });
    const all = show("all", [], map(), [2], "zh-TW");
    expect(all.map((s) => [s.icon, s.picked])).toEqual([
      [SEED, false],
      [RUNE, true],
      [RUNE, false],
    ]);
    expect(all[0].label).toBe("Golden Seed (zh)");
  });
});

describe("placing a pin from an item's spots", () => {
  it("counts each place once, as a lot's chained rows share its spot", () => {
    const chained = { ...both, lot: 20 };
    const withChain = {
      ...data,
      pickupsByItem: new Map([[TEAR, [both, chained]]]),
    } as unknown as GameData;
    expect(spotsOfItem(withChain, TEAR)).toEqual([both]);
    expect(spotsOfItem(data, RUNE)).toEqual([both, rune]);
    expect(spotsOfItem(data, "goods/1")).toEqual([]);
  });

  it("puts a new pin holding the item on the spot", () => {
    expect(pinAtSpot(SEED, seed)).toMatchObject({
      layer: "overworld",
      x: 100,
      y: 0,
      kind: "junction",
      items: [SEED],
    });
  });
});
