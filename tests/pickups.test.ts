import { describe, expect, it } from "vitest";
import type { MapDocument, MapNode, WishlistItem } from "../src/domain/types";
import type { CatalogPickup, GameData } from "../src/map/catalog";
import { translate } from "../src/i18n/translation";
import {
  applyImport,
  importFlags,
  planImport,
  summarizeChanges,
} from "../src/progress/importSave";
import { trackingPickup } from "../src/progress/pickups";
import { initialDocuments } from "../src/storage/schema";

const SEED = "goods/10010";
const TEAR = "goods/10020";
const spot = (lot: number, x: number, items = [SEED]): CatalogPickup => ({
  lot,
  flag: lot + 500000,
  items,
  layer: "overworld",
  x,
  y: 0,
  legacy: false,
});
const seeds = [spot(1, 0), spot(2, 1000)];
const tear = spot(3, 5000, [TEAR]);
const pickups = [...seeds, tear];
const data = {
  catalog: { items: [], graces: [], bosses: [], pickups },
  byId: new Map([
    [SEED, { id: SEED, name: { en: "Golden Seed", "zh-TW": "黃金種子" } }],
    [TEAR, { id: TEAR, name: { en: "Sacred Tear", "zh-TW": "聖杯露滴" } }],
  ]),
  pickupsByItem: new Map([
    [SEED, seeds],
    [TEAR, [tear]],
  ]),
} as unknown as GameData;
const pin = (id: string, x: number, items: string[] = []): MapNode => ({
  id,
  layer: "overworld",
  x,
  y: 0,
  kind: "junction",
  label: "",
  ref: null,
  items,
});
const entry = (item: string, pin?: string): WishlistItem => ({
  item,
  ...(pin && { pin }),
  status: "needed",
  note: "",
});

describe("tracking a wishlist entry by the game's pickup spots", () => {
  const nodes = [pin("near-2", 1150), pin("far", 3000)];
  it("uses an item's only spot, wherever its pin is", () => {
    expect(trackingPickup(data, nodes, entry(TEAR, "far"))).toBe(tear);
    expect(trackingPickup(data, nodes, entry(TEAR))).toBe(tear);
  });

  it("picks the spot nearest the pin when the item has several", () => {
    expect(trackingPickup(data, nodes, entry(SEED, "near-2"))).toBe(seeds[1]);
  });

  it("falls back to marking by hand when no spot is near the pin", () => {
    expect(trackingPickup(data, nodes, entry(SEED, "far"))).toBeUndefined();
    expect(trackingPickup(data, nodes, entry(SEED))).toBeUndefined();
    expect(trackingPickup(data, nodes, entry("goods/1"))).toBeUndefined();
  });
});

describe("importing picked-up items", () => {
  const doc = {
    schemaVersion: 4,
    nodes: [pin("seed-pin", 20, [SEED]), pin("tear-pin", 5100, [TEAR])],
    edges: [{ id: "e", nodes: ["seed-pin", "tear-pin"], step: 1 }],
  } as unknown as MapDocument;
  const t = (key: string, values?: Record<string, string | number>) =>
    translate("en", key, values);

  it("asks the save about tracked entries, joined ones included", () => {
    const saved = [{ ...entry(SEED, "seed-pin"), status: "skipped" as const }];
    const { known, isItem, itemName, tracked } = importFlags(
      data,
      doc,
      "en",
      saved,
    );
    expect(known).toEqual([500001, 500003]);
    expect(isItem(500003)).toBe(true);
    expect(itemName.get(500003)).toBe("Sacred Tear");
    // The tear's entry joined from the walked path; the seed's is saved.
    expect(tracked.map((t) => t.entry)).toEqual([
      saved[0],
      entry(TEAR, "tear-pin"),
    ]);
  });

  it("marks needed entries acquired, saving joined ones, and never undoes it", () => {
    const start = initialDocuments().player;
    const profile = start.profiles[0];
    const player = {
      ...start,
      profiles: [
        {
          ...profile,
          wishlist: [entry(SEED, "seed-pin")],
          progress: { ...profile.progress, flags: [] },
        },
      ],
    };
    const { known, tracked } = importFlags(
      data,
      doc,
      "en",
      player.profiles[0].wishlist,
    );
    const plan = planImport(
      player.profiles[0].progress,
      known,
      [500001, 500003],
      null,
      tracked,
    );
    expect(plan.acquired).toHaveLength(2);
    expect(
      summarizeChanges(
        t,
        plan,
        () => false,
        () => true,
      ),
    ).toBe("+2 wishlist items acquired");
    const link = { steamId: "1", slot: 0, name: "Tarnished" };
    const after = applyImport(player, profile.id, plan, link, null);
    expect(after.profiles[0].wishlist).toEqual([
      { ...entry(SEED, "seed-pin"), status: "acquired" },
      { ...entry(TEAR, "tear-pin"), status: "acquired" },
    ]);
    expect(after.profiles[0].progress.flags).toEqual([500001, 500003]);

    // A save without the pickups clears the flags but keeps the entries acquired.
    const again = importFlags(data, doc, "en", after.profiles[0].wishlist);
    const reset = planImport(
      after.profiles[0].progress,
      again.known,
      [],
      null,
      again.tracked,
    );
    expect(reset.acquired).toEqual([]);
    expect(
      summarizeChanges(
        t,
        reset,
        () => false,
        () => true,
      ),
    ).toBe("2 items no longer picked up");
  });
});
