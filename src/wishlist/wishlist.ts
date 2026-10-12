import {
  WISHLIST_STATUSES,
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

export const updateWishlistItem = (
  player: PlayerDocument,
  profileId: string,
  item: string,
  changes: Partial<Omit<WishlistItem, "item">>,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.map((w) => (w.item === item ? { ...w, ...changes } : w)),
  );

export const removeFromWishlist = (
  player: PlayerDocument,
  profileId: string,
  item: string,
): PlayerDocument =>
  changeWishlist(player, profileId, (wishlist) =>
    wishlist.filter((w) => w.item !== item),
  );

export const countByStatus = (wishlist: WishlistItem[]) =>
  Object.fromEntries(
    WISHLIST_STATUSES.map((status) => [
      status,
      wishlist.filter((w) => w.status === status).length,
    ]),
  ) as Record<WishlistStatus, number>;
