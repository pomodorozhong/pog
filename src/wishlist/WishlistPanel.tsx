import {
  WISHLIST_STATUSES,
  type Language,
  type MapDocument,
  type MapNode,
  type PlayerDocument,
  type WishlistItem,
  type WishlistStatus,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import {
  displayName,
  iconUrl,
  isItem,
  searchCatalog,
  type GameData,
} from "../map/catalog";
import { spotsOfItem } from "../map/itemSpots";
import { NODE_KIND_NAMES } from "../map/labels";
import { activeProfile } from "../profiles/profiles";
import {
  addToWishlist,
  attachToPin,
  combinedWishlist,
  countByStatus,
  removeFromWishlist,
  strandedEntries,
  updateWishlistItem,
  type PinnedEntry,
} from "./wishlist";
import { useSharedState } from "../sync/shared";

export const STATUS_NAMES: Record<WishlistStatus, string> = {
  needed: "Needed",
  acquired: "Acquired",
  skipped: "Skipped",
};

type Props = {
  t: Translate;
  language: Language;
  data: GameData;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
};

/**
 * Where an entry is: a grace by its name, a pin by its label when it has
 * one, since a pin's own name is the item it holds.
 */
export function pinName(
  t: Translate,
  language: Language,
  data: GameData,
  doc: MapDocument,
  pin: string,
) {
  const node = doc.nodes.find((n) => n.id === pin);
  if (!node) return "";
  const name =
    displayName(data, node, language) || t(NODE_KIND_NAMES[node.kind]);
  return node.kind === "grace" ? name : node.label.trim() || name;
}

/** The active playthrough's wishlist: add items, set their status and notes. */
export function WishlistPanel({
  t,
  language,
  data,
  player,
  setPlayer,
  doc,
  showNode,
  placeFromGameData,
}: Props & {
  doc: MapDocument;
  showNode(id: string): void;
  /** Put an entry on a new pin at one of its item's spots in the game. */
  placeFromGameData(entry: WishlistItem): void;
}) {
  const profile = activeProfile(player);
  const { pinned, unpinned } = combinedWishlist(doc, profile.wishlist);
  const wishlist = [...pinned, ...unpinned];
  const stranded = strandedEntries(doc, unpinned).length;
  const [query, setQuery] = useSharedState("wishlist.query", "");
  // The item just added from the search, offered a pin from game data, in
  // the playthrough it was added to.
  const [added, setAdded] = useSharedState<{
    profile: string;
    item: string;
  } | null>("wishlist.added", null);
  const addedEntry =
    added?.profile === profile.id
      ? unpinned.find((w) => w.item === added.item)
      : undefined;
  // The route list shows the wishlist; this one, for notes and statuses,
  // stays folded so the panel stays short.
  const [open, setOpen] = useSharedState("wishlist.open", false);
  // Search adds an entry with no pin; an item that has one already says so.
  const waiting = new Set(unpinned.map((w) => w.item));
  const results = searchCatalog(data.catalog.items, query, 10);
  const counts = countByStatus(wishlist);
  const other = language === "en" ? "zh-TW" : "en";

  const entryRow = (entry: WishlistItem & { joined?: true }) => {
    const item = data.byId.get(entry.item);
    const at = entry.pin ?? null;
    // An entry whose pin no longer holds its item reads as having none.
    const pin = pinned.includes(entry as PinnedEntry) ? entry.pin : undefined;
    return (
      <li
        key={`${at ?? ""} ${entry.item}`}
        className={`space-y-1 ${entry.status === "needed" ? "" : "opacity-70"}`}
      >
        <div className="flex items-center gap-2">
          {item && isItem(item) && item.icon && (
            <img
              src={iconUrl(item.icon)}
              alt=""
              className="size-8 rounded bg-ink"
              loading="lazy"
            />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={`truncate text-sm ${entry.status === "acquired" ? "line-through" : ""}`}
            >
              {item?.name[language] ?? entry.item}
            </span>
            {pin && (
              <span className="truncate text-xs text-muted">
                {pinName(t, language, data, doc, pin)}
              </span>
            )}
          </span>
          <select
            aria-label={t("Status")}
            className="field"
            value={entry.status}
            onChange={(e) =>
              setPlayer(
                updateWishlistItem(player, profile.id, entry.item, at, {
                  status: e.target.value as WishlistStatus,
                }),
              )
            }
          >
            {WISHLIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(STATUS_NAMES[status])}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="field w-full text-sm"
          rows={2}
          aria-label={t("Your note")}
          placeholder={t("Your note")}
          value={entry.note}
          onChange={(e) =>
            setPlayer(
              updateWishlistItem(player, profile.id, entry.item, at, {
                note: e.target.value,
              }),
            )
          }
        />
        <div className="flex gap-3 text-xs">
          {pin ? (
            <button className="link" onClick={() => showNode(pin)}>
              {t("Show on map")}
            </button>
          ) : (
            <PlaceFromGameData
              t={t}
              data={data}
              entry={entry}
              place={placeFromGameData}
            />
          )}
          {/* A joined item leaves with its path, so there's nothing to remove. */}
          {entry.joined ? (
            <span className="ml-auto text-muted">{t("On a walked path")}</span>
          ) : (
            <button
              className="link ml-auto"
              onClick={() =>
                setPlayer(
                  removeFromWishlist(player, profile.id, entry.item, at),
                )
              }
            >
              {t("Remove")}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="card space-y-2" aria-label={t("Wishlist")}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="label">{t("Wishlist")}</h3>
          {wishlist.length > 0 && (
            <p className="text-xs text-muted">
              {t("{needed} needed · {acquired} acquired · {skipped} skipped", {
                ...counts,
              })}
            </p>
          )}
        </div>
        {wishlist.length > 0 && (
          <button
            className="chip shrink-0 text-xs"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? t("Hide notes") : t("Notes and status")}
          </button>
        )}
      </div>
      {stranded > 0 && (
        <p role="note" className="rounded border border-gold/50 p-2 text-xs">
          {t(
            "{count} saved items aren't attached to a pin, though a pin on the map holds them, so their status and note don't show in the route. Attach them from that pin's Items.",
            { count: String(stranded) },
          )}
        </p>
      )}
      <input
        className="field w-full"
        aria-label={t("Add to wishlist")}
        placeholder={t("Add an item: search English or 中文")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <ul
          data-scroll-sync="wishlist-search"
          className="max-h-64 overflow-y-auto rounded border border-line"
        >
          {results.map((item) => (
            <li key={item.id}>
              <button
                className="flex w-full items-center gap-2 px-2 py-1 text-left enabled:hover:bg-ink disabled:cursor-default"
                disabled={waiting.has(item.id)}
                onClick={() => {
                  setPlayer(addToWishlist(player, profile.id, item.id));
                  setQuery("");
                  setAdded({ profile: profile.id, item: item.id });
                }}
              >
                {item.icon && (
                  <img
                    src={iconUrl(item.icon)}
                    alt=""
                    className="size-8"
                    loading="lazy"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name[language]}</span>
                  <span className="block truncate text-xs text-muted">
                    {item.name[other]}
                    {item.dlc && ` · ${t("DLC")}`}
                  </span>
                </span>
                {waiting.has(item.id) && (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                    {t("On the wishlist, no pin")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {addedEntry && !query && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-line p-2 text-xs"
        >
          <span>
            {t("{item} is on the wishlist, not attached to a pin.", {
              item: data.byId.get(addedEntry.item)?.name[language] ?? "",
            })}
          </span>
          <PlaceFromGameData
            t={t}
            data={data}
            entry={addedEntry}
            place={(entry) => {
              setAdded(null);
              placeFromGameData(entry);
            }}
          />
          <button className="link ml-auto" onClick={() => setAdded(null)}>
            {t("Not now")}
          </button>
        </div>
      )}
      {open && (
        <>
          <ul className="space-y-3">{pinned.map(entryRow)}</ul>
          {unpinned.length > 0 && (
            <>
              <h4 className="label pt-1">{t("Not attached to a pin")}</h4>
              <ul className="space-y-3">{unpinned.map(entryRow)}</ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The offer to place an entry's pin from game data, with how many spots its
 * item has; an item the game data doesn't place is attached by hand.
 */
function PlaceFromGameData({
  t,
  data,
  entry,
  place,
}: {
  t: Translate;
  data: GameData;
  entry: WishlistItem;
  place(entry: WishlistItem): void;
}) {
  const count = spotsOfItem(data, entry.item).length;
  if (!count)
    return (
      <span className="text-muted">{t("Attach it from a pin's Items.")}</span>
    );
  return (
    <button className="link" onClick={() => place(entry)}>
      {count === 1
        ? t("Place pin from game data")
        : t("Place pin from game data ({count} spots)", { count })}
    </button>
  );
}

/**
 * Wishlist status of an item on a pin: this pin's own entry. An item on a
 * pin a walked path goes through is already on the wishlist.
 */
export function PinWishlist({
  t,
  player,
  setPlayer,
  doc,
  pin,
  item,
  estimate,
}: Omit<Props, "data" | "language"> & {
  doc: MapDocument;
  pin: string;
  item: string;
  /** What adding this pin would cost the route, already worded. */
  estimate: string;
}) {
  const profile = activeProfile(player);
  const entry = combinedWishlist(doc, profile.wishlist).pinned.find(
    (w) => w.item === item && w.pin === pin,
  );
  if (!entry)
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          className="chip text-xs"
          onClick={() =>
            setPlayer(addToWishlist(player, profile.id, item, pin))
          }
        >
          {t("Add to wishlist")}
        </button>
        <p className="text-xs text-muted">{estimate}</p>
      </div>
    );
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted">{t("Wishlist")}</span>
      <select
        className="field py-0.5 text-xs"
        value={entry.status}
        onChange={(e) =>
          setPlayer(
            updateWishlistItem(player, profile.id, item, pin, {
              status: e.target.value as WishlistStatus,
            }),
          )
        }
      >
        {WISHLIST_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(STATUS_NAMES[status])}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Saved entries not attached to a pin, offered in a pin's item editor beside
 * the catalog search. Choosing one puts its item on the pin and attaches the
 * entry, with its status and note.
 */
export function UnpinnedPicker({
  t,
  language,
  data,
  player,
  setPlayer,
  doc,
  node,
  addItem,
}: Props & {
  doc: MapDocument;
  node: MapNode;
  addItem(item: string): void;
}) {
  const profile = activeProfile(player);
  const { pinned, unpinned } = combinedWishlist(doc, profile.wishlist);
  // An item already saved at this pin has its entry; another can't join it.
  const saved = new Set(
    pinned.filter((w) => w.pin === node.id && !w.joined).map((w) => w.item),
  );
  const choices = unpinned.filter((w) => !saved.has(w.item));
  if (!choices.length) return null;
  return (
    <div className="space-y-1 pt-1">
      <h4 className="label">{t("From the wishlist, no pin yet")}</h4>
      <ul>
        {choices.map((entry) => {
          const item = data.byId.get(entry.item);
          return (
            <li key={`${entry.pin ?? ""} ${entry.item}`}>
              <button
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-ink"
                onClick={() => {
                  addItem(entry.item);
                  setPlayer(attachToPin(player, profile.id, entry, node.id));
                }}
              >
                {item && isItem(item) && item.icon && (
                  <img
                    src={iconUrl(item.icon)}
                    alt=""
                    className="size-8 rounded bg-ink"
                    loading="lazy"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {item?.name[language] ?? entry.item}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[t(STATUS_NAMES[entry.status]), entry.note]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
