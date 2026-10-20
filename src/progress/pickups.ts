import type { MapNode, WishlistItem } from "../domain/types";
import type { CatalogPickup, GameData } from "../map/catalog";

/**
 * How far a wishlist pin may sit from the game's spot for an item and still
 * name that spot, in map pixels. Spots inside legacy dungeons and caves are
 * projected onto the open-world map and can be 100–200 px off the entrance
 * the player pins.
 */
export const PIN_REACH = 250;

/**
 * The game's pickup spot that tells whether a wishlist entry is picked up.
 * An item with one spot uses it, wherever the entry's pin is. An item with
 * several (Golden Seeds, Smithing Stones) uses the spot nearest the entry's
 * pin on its layer, within `PIN_REACH`. Otherwise none: shop wares, boss and
 * enemy drops, and entries whose pin is near none of the spots, are marked by
 * hand.
 */
export function trackingPickup(
  data: GameData,
  nodes: MapNode[],
  entry: WishlistItem,
): CatalogPickup | undefined {
  const spots = (data.pickupsByItem.get(entry.item) ?? []).filter(
    (p) => p.flag !== null,
  );
  if (new Set(spots.map((p) => p.lot)).size === 1) return spots[0];
  const pin = nodes.find((n) => n.id === entry.pin);
  if (!pin) return undefined;
  let best: CatalogPickup | undefined;
  let bestDistance = PIN_REACH;
  for (const spot of spots) {
    if (spot.layer !== pin.layer) continue;
    const d = Math.hypot(spot.x - pin.x, spot.y - pin.y);
    if (d <= bestDistance) [best, bestDistance] = [spot, d];
  }
  return best;
}

/** Each wishlist entry the game data can track, with its pickup flag. */
export const trackedEntries = (
  data: GameData,
  nodes: MapNode[],
  wishlist: WishlistItem[],
) =>
  wishlist.flatMap((entry) => {
    const flag = trackingPickup(data, nodes, entry)?.flag;
    return flag == null ? [] : [{ entry, flag }];
  });
