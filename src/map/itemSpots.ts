import type {
  ItemSpotMode,
  Language,
  MapDocument,
  WishlistItem,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import { combinedWishlist } from "../wishlist/wishlist";
import type { CatalogPickup, GameData } from "./catalog";

/** A game item spot the map shows, with its name and whether it's picked up. */
export type ItemSpot = CatalogPickup & {
  picked: boolean;
  /** The item to show its icon: the first one on the wishlist, else the first. */
  icon: string | null;
  label: string;
};

/**
 * The items whose spots "Wishlist items" shows: the wishlist's, entries
 * joined from a walked path too, skipped ones not. Sorted, so it can be
 * compared to tell whether the spots shown change.
 */
export function wishedItems(map: MapDocument, wishlist: WishlistItem[]) {
  const { pinned, unpinned } = combinedWishlist(map, wishlist);
  return [
    ...new Set(
      [...pinned, ...unpinned]
        .filter((w) => w.status !== "skipped")
        .map((w) => w.item),
    ),
  ].sort();
}

/**
 * The game's item spots to show for a playthrough: none, those of its
 * wished items (see `wishedItems`), or all of them. A spot is picked up once
 * progress has its pickup flag, which the save import records.
 */
export function shownSpots(
  t: Translate,
  data: GameData,
  language: Language,
  mode: ItemSpotMode,
  wished: string[],
  flags: number[],
): ItemSpot[] {
  if (mode === "off") return [];
  const set = new Set(flags);
  const wanted = new Set(wished);
  const spots =
    mode === "all"
      ? data.catalog.pickups
      : [
          ...new Set(
            [...wanted].flatMap((item) => data.pickupsByItem.get(item) ?? []),
          ),
        ];
  return spots.map((spot) => {
    const picked = spot.flag !== null && set.has(spot.flag);
    const names = spot.items.map(
      (id) => data.byId.get(id)?.name[language] ?? id,
    );
    return {
      ...spot,
      picked,
      icon: spot.items.find((id) => wanted.has(id)) ?? spot.items[0] ?? null,
      label: [...names, ...(picked ? [t("Picked up")] : [])].join(" · "),
    };
  });
}

/** Which marker a spot is: a lot can have several spots. */
export const spotKey = (spot: CatalogPickup) =>
  `${spot.lot} ${spot.layer} ${spot.x} ${spot.y}`;
