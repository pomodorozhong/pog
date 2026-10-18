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

/** Whether an entry is the one for this item at this pin (null: no pin). */
const isEntry = (w: WishlistItem, item: string, pin: string | null) =>
  w.item === item && (w.pin ?? null) === pin;

/**
 * Add an item as needed, at a pin or with none. An entry already there for
 * that item and pin is left as it is.
 */
export const addToWishlist = (
  player: PlayerDocument,
  profileId: string,
  item: string,
  pin: string | null = null,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.some((w) => isEntry(w, item, pin))
      ? wishlist
      : [
          ...wishlist,
          { item, ...(pin !== null && { pin }), status: "needed", note: "" },
        ],
  );

/**
 * Change the status or note of an item's entry at a pin (null: no pin). An
 * entry not saved yet, such as one that joined from a walked path, is saved
 * with the change, so it stays.
 */
export const updateWishlistItem = (
  player: PlayerDocument,
  profileId: string,
  item: string,
  pin: string | null,
  changes: Partial<Pick<WishlistItem, "status" | "note">>,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.some((w) => isEntry(w, item, pin))
      ? wishlist.map((w) => (isEntry(w, item, pin) ? { ...w, ...changes } : w))
      : [
          ...wishlist,
          {
            item,
            ...(pin !== null && { pin }),
            status: "needed",
            note: "",
            ...changes,
          },
        ],
  );

export const removeFromWishlist = (
  player: PlayerDocument,
  profileId: string,
  item: string,
  pin: string | null,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.filter((w) => !isEntry(w, item, pin)),
  );

/**
 * Attach a saved entry that isn't attached to a pin to this pin, with its
 * status and note. The caller puts the item on the pin.
 */
export const attachToPin = (
  player: PlayerDocument,
  profileId: string,
  entry: WishlistItem,
  pin: string,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.map((w) =>
      isEntry(w, entry.item, entry.pin ?? null) ? { ...w, pin } : w,
    ),
  );

/** A wishlist entry at a pin that holds its item: saved, or joined from a walked path. */
export type PinnedEntry = WishlistItem & { pin: string; joined?: true };

/**
 * The wishlist as every list and the route read it. `pinned` holds the saved
 * entries whose pin holds their item, then an entry for each pin a walked
 * path goes through for each item on it that has none saved, as needed, in
 * step order. Joined entries aren't saved until the player changes one, so
 * they leave again when no walked path reaches them, and editing paths never
 * rewrites the saved wishlist. `unpinned` holds the saved entries with no
 * pin, or whose pin is gone or no longer holds the item; they keep their
 * stored pin, which identifies them, and come back if the pin does.
 */
export function combinedWishlist(
  map: MapDocument,
  wishlist: WishlistItem[],
): { pinned: PinnedEntry[]; unpinned: WishlistItem[] } {
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  const holds = (pin: string | undefined, item: string) => {
    const node = pin === undefined ? undefined : nodes.get(pin);
    return node !== undefined && pinItems(node).includes(item);
  };
  const pinned: PinnedEntry[] = [];
  const unpinned: WishlistItem[] = [];
  for (const w of wishlist)
    if (holds(w.pin, w.item)) pinned.push(w as PinnedEntry);
    else unpinned.push(w);
  const listed = new Set(pinned.map((w) => `${w.pin} ${w.item}`));
  const walked = map.edges.filter(isWalked).sort((a, b) => a.step - b.step);
  for (const edge of walked)
    for (const pin of edge.nodes) {
      const node = nodes.get(pin);
      for (const item of node ? pinItems(node) : [])
        if (!listed.has(`${pin} ${item}`)) {
          listed.add(`${pin} ${item}`);
          pinned.push({ item, pin, status: "needed", note: "", joined: true });
        }
    }
  return { pinned, unpinned };
}

/**
 * Entries not attached to a pin although a pin on the map holds their item,
 * as wishlists saved before entries had pins are. Each such pin joins on its
 * own, so the entry's status and note don't show until it is attached.
 */
export const strandedEntries = (map: MapDocument, unpinned: WishlistItem[]) =>
  unpinned.filter((w) => map.nodes.some((n) => pinItems(n).includes(w.item)));

export const countByStatus = (wishlist: WishlistItem[]) =>
  Object.fromEntries(
    WISHLIST_STATUSES.map((status) => [
      status,
      wishlist.filter((w) => w.status === status).length,
    ]),
  ) as Record<WishlistStatus, number>;

/** A wishlist entry with its pin, and the step of the first walked path through it. */
export type WalkEntry = { entry: PinnedEntry; pin: string; step: number };

/**
 * The wishlist in walking order: each entry where the walk first reaches its
 * pin (by step, then along that path), then by its place among the pin's
 * items, so marking an entry never moves it. Entries whose pin is on no path
 * come after, in wishlist order.
 */
export function walkOrder(map: MapDocument, wishlist: PinnedEntry[]) {
  const reached = new Map<string, { step: number; order: number }>();
  const walked = map.edges.filter(isWalked).sort((a, b) => a.step - b.step);
  for (const edge of walked)
    for (const node of edge.nodes)
      if (!reached.has(node))
        reached.set(node, { step: edge.step, order: reached.size });
  const nodes = new Map(map.nodes.map((n) => [n.id, n]));
  const place = (entry: PinnedEntry) =>
    pinItems(nodes.get(entry.pin)!).indexOf(entry.item);
  const onRoute: (WalkEntry & { order: number })[] = [];
  const offRoute: { entry: PinnedEntry; pin: string }[] = [];
  for (const entry of wishlist) {
    const at = reached.get(entry.pin);
    if (!at) offRoute.push({ entry, pin: entry.pin });
    else onRoute.push({ entry, pin: entry.pin, ...at });
  }
  onRoute.sort((a, b) => a.order - b.order || place(a.entry) - place(b.entry));
  return {
    onRoute: onRoute.map(({ entry, pin, step }): WalkEntry => ({
      entry,
      pin,
      step,
    })),
    offRoute,
  };
}
