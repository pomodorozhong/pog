import {
  WISHLIST_STATUSES,
  isWalked,
  pinItems,
  type MapDocument,
  type PlayerDocument,
  type WishlistItem,
  type WishlistStatus,
} from "../domain/types";

function changeWishlist(
  player: PlayerDocument,
  profileId: string,
  change: (wishlist: WishlistItem[]) => WishlistItem[],
): PlayerDocument {
  return {
    ...player,
    profiles: player.profiles.map((p) =>
      p.id === profileId ? { ...p, wishlist: change(p.wishlist) } : p,
    ),
  };
}

/** Add an item as needed. An item already on the wishlist is left as it is. */
export const addToWishlist = (
  player: PlayerDocument,
  profileId: string,
  item: string,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.some((w) => w.item === item)
      ? wishlist
      : [...wishlist, { item, status: "needed", note: "" }],
  );

/**
 * Change an item's status or note. An item not saved yet, such as one that
 * joined from a walked path, is saved with the change, so it stays.
 */
export const updateWishlistItem = (
  player: PlayerDocument,
  profileId: string,
  item: string,
  changes: Partial<Omit<WishlistItem, "item">>,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.some((w) => w.item === item)
      ? wishlist.map((w) => (w.item === item ? { ...w, ...changes } : w))
      : [...wishlist, { item, status: "needed", note: "", ...changes }],
  );

export const removeFromWishlist = (
  player: PlayerDocument,
  profileId: string,
  item: string,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.filter((w) => w.item !== item),
  );

/** A wishlist entry as shown: saved, or joined from a walked path. */
export type WishlistEntry = WishlistItem & { joined?: true };

/**
 * The wishlist as every list and the route read it: the saved entries, then
 * each item on a pin a walked path goes through that isn't saved, as needed,
 * in step order. Joined items aren't saved until the player changes one, so
 * they leave again when no walked path reaches them, and editing paths never
 * rewrites the saved wishlist.
 */
export function combinedWishlist(
  map: MapDocument,
  wishlist: WishlistItem[],
): WishlistEntry[] {
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  const listed = new Set(wishlist.map((w) => w.item));
  const joined: WishlistEntry[] = [];
  const walked = map.edges.filter(isWalked).sort((a, b) => a.step - b.step);
  for (const edge of walked)
    for (const id of edge.nodes) {
      const node = nodes.get(id);
      for (const item of node ? pinItems(node) : [])
        if (!listed.has(item)) {
          listed.add(item);
          joined.push({ item, status: "needed", note: "", joined: true });
        }
    }
  return joined.length ? [...wishlist, ...joined] : wishlist;
}

export const countByStatus = (wishlist: WishlistItem[]) =>
  Object.fromEntries(
    WISHLIST_STATUSES.map((status) => [
      status,
      wishlist.filter((w) => w.status === status).length,
    ]),
  ) as Record<WishlistStatus, number>;

/** A wishlist entry with the item pin the walk reaches it at, and that path's step. */
export type WalkEntry = { entry: WishlistEntry; pin: string; step: number };

/**
 * The wishlist in walking order: each item by the lowest step of a path
 * through one of its pins. Items with no pin, or a pin on no path, come after
 * in wishlist order.
 */
export function walkOrder(map: MapDocument, wishlist: WishlistEntry[]) {
  const steps = new Map<string, number>();
  for (const edge of map.edges.filter(isWalked))
    for (const node of edge.nodes)
      steps.set(node, Math.min(steps.get(node) ?? Infinity, edge.step));
  const onRoute: WalkEntry[] = [];
  const offRoute: { entry: WishlistEntry; pin: string | null }[] = [];
  for (const entry of wishlist) {
    const pins = map.nodes.filter((n) => pinItems(n).includes(entry.item));
    const reached = pins
      .filter((n) => steps.has(n.id))
      .map((n) => ({ entry, pin: n.id, step: steps.get(n.id)! }))
      .sort((a, b) => a.step - b.step)[0];
    if (reached) onRoute.push(reached);
    else offRoute.push({ entry, pin: pins[0]?.id ?? null });
  }
  onRoute.sort((a, b) => a.step - b.step);
  return { onRoute, offRoute };
}
