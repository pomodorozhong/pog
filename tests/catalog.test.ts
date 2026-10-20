import { describe, expect, it } from "vitest";
import { loadGameData, type CatalogPickup } from "../src/map/catalog";

const layer = { mapId: "test", tileSize: 256, maxZoom: 0, size: 1000 };
const layers = {
  overworld: layer,
  underground: layer,
  dlc: layer,
  "dlc-underground": layer,
};
const pickup = (lot: number, items: string[]): CatalogPickup => ({
  lot,
  flag: lot + 500000,
  items,
  layer: "overworld",
  x: lot,
  y: 0,
  legacy: false,
});
const serve =
  (catalog: object): typeof fetch =>
  async (url) =>
    new Response(
      JSON.stringify(String(url).endsWith("catalog.json") ? catalog : layers),
    );
const empty = { items: [], graces: [], places: [], npcs: [] };

describe("loadGameData", () => {
  it("indexes each item's pickup spots", async () => {
    const seed = pickup(1, ["goods/10010"]);
    const chest = pickup(2, ["goods/10010", "goods/10020"]);
    const data = await loadGameData(
      serve({ ...empty, bosses: [], pickups: [seed, chest] }),
    );
    expect(data.pickupsByItem.get("goods/10010")).toEqual([seed, chest]);
    expect(data.pickupsByItem.get("goods/10020")).toEqual([chest]);
    expect(data.pickupsByItem.has("goods/10030")).toBe(false);
  });

  it("reads a catalog extracted before bosses and pickups", async () => {
    const data = await loadGameData(serve(empty));
    expect(data.catalog.bosses).toEqual([]);
    expect(data.catalog.pickups).toEqual([]);
    expect(data.pickupsByItem.size).toBe(0);
  });
});
