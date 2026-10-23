import type {
  ItemSpotMode,
  Language,
  MapDocument,
  MapNode,
  WishlistItem,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import { combinedWishlist } from "../wishlist/wishlist";
import type { CatalogPickup, GameData } from "./catalog";
import { newId } from "./editing";

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
  return spots.map((spot) =>
    toItemSpot(t, data, language, spot, set, (id) => wanted.has(id)),
  );
}

function toItemSpot(
  t: Translate,
  data: GameData,
  language: Language,
  spot: CatalogPickup,
  flags: Set<number>,
  /** Items whose icon a spot giving several shows first. */
  first: (item: string) => boolean,
): ItemSpot {
  const picked = spot.flag !== null && flags.has(spot.flag);
  const names = spot.items.map((id) => data.byId.get(id)?.name[language] ?? id);
  return {
    ...spot,
    picked,
    icon: spot.items.find(first) ?? spot.items[0] ?? null,
    label: [...names, ...(picked ? [t("Picked up")] : [])].join(" · "),
  };
}

/**
 * The game's spots for an item, each place once: the lots chained after a
 * placed lot share its spot.
 */
export function spotsOfItem(data: GameData, item: string): CatalogPickup[] {
  const spots = data.pickupsByItem.get(item) ?? [];
  const place = (s: CatalogPickup) => `${s.layer} ${s.x} ${s.y}`;
  return spots.filter(
    (s, i) => spots.findIndex((o) => place(o) === place(s)) === i,
  );
}

/** An item's spots to choose a pin's place from, with its icon. */
export const choosableSpots = (
  t: Translate,
  data: GameData,
  language: Language,
  item: string,
  flags: number[],
): ItemSpot[] => {
  const set = new Set(flags);
  return spotsOfItem(data, item).map((spot) =>
    toItemSpot(t, data, language, spot, set, (id) => id === item),
  );
};

/** A new pin on a game spot, holding the item. */
export const pinAtSpot = (
  item: string,
  spot: Pick<CatalogPickup, "layer" | "x" | "y">,
): MapNode => ({
  id: newId("junction"),
  layer: spot.layer,
  x: spot.x,
  y: spot.y,
  kind: "junction",
  label: "",
  ref: null,
  items: [item],
});

/** Which marker a spot is: a lot can have several spots. */
export const spotKey = (spot: CatalogPickup) =>
  `${spot.lot} ${spot.layer} ${spot.x} ${spot.y}`;
