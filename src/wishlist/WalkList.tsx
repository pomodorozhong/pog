import { useState } from "react";
import {
  WISHLIST_STATUSES,
  type Language,
  type MapDocument,
  type PlayerDocument,
  type WishlistItem,
  type WishlistStatus,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import { iconUrl, isItem, type GameData } from "../map/catalog";
import { activeProfile } from "../profiles/profiles";
import { STATUS_NAMES, pinName } from "./WishlistPanel";
import {
  combinedWishlist,
  countByStatus,
  updateWishlistItem,
  walkOrder,
  type PinnedEntry,
} from "./wishlist";

const fold = (text: string) => text.normalize("NFKC").toLowerCase();

/**
 * The item progress: each wishlist entry at a pin, in the order the walk
 * reaches it, with tap-to-mark status. Entries not attached to a pin aren't
 * shown. A search box and a status filter narrow what's shown.
 */
export function WalkList({
  t,
  language,
  data,
  player,
  setPlayer,
  doc,
  showNode,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
  doc: MapDocument;
  showNode(id: string): void;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<WishlistStatus | "all">("all");
  const profile = activeProfile(player);
  const { pinned: wishlist, unpinned } = combinedWishlist(
    doc,
    profile.wishlist,
  );
  const { onRoute, offRoute } = walkOrder(doc, wishlist);
  const counts = countByStatus(wishlist);
  // Tapping marks an item acquired; tapping an acquired item marks it needed again.
  const toggle = (entry: PinnedEntry) =>
    setPlayer(
      updateWishlistItem(player, profile.id, entry.item, entry.pin, {
        status: entry.status === "acquired" ? "needed" : "acquired",
      }),
    );
  const where = (pin: string) => pinName(t, language, data, doc, pin);
  // An item matches by its name in either language, its pin's name or its note.
  const q = fold(query.trim());
  const matches = (entry: WishlistItem, pin: string) => {
    if (shown !== "all" && entry.status !== shown) return false;
    if (!q) return true;
    const item = data.byId.get(entry.item);
    return [item?.name.en, item?.name["zh-TW"], where(pin), entry.note].some(
      (text) => text && fold(text).includes(q),
    );
  };
  const route = onRoute.filter((r) => matches(r.entry, r.pin));
  const off = offRoute.filter((r) => matches(r.entry, r.pin));

  const row = (entry: PinnedEntry, step?: number) => {
    const item = data.byId.get(entry.item);
    const name = item?.name[language] ?? entry.item;
    const place =
      step === undefined
        ? t("{place} · not on a path yet", { place: where(entry.pin) })
        : where(entry.pin);
    return (
      <li
        key={`${entry.pin} ${entry.item}`}
        className="flex items-center gap-2"
      >
        <span
          className={`grid h-5 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step === undefined ? "border border-dashed border-line text-muted" : "bg-gold text-ink"}`}
        >
          {step ?? "–"}
        </span>
        <button
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => showNode(entry.pin)}
        >
          {item && isItem(item) && item.icon && (
            <img
              src={iconUrl(item.icon)}
              alt=""
              className="size-8 shrink-0 rounded bg-ink"
              loading="lazy"
            />
          )}
          <span className="flex min-w-0 flex-col">
            <span
              className={`truncate ${entry.status === "needed" ? "" : "text-muted line-through"}`}
            >
              {name}
            </span>
            <span className="truncate text-xs text-muted">{place}</span>
          </span>
        </button>
        <button
          className="grid size-11 shrink-0 place-items-center"
          aria-pressed={entry.status === "acquired"}
          aria-label={t("{item}: acquired", { item: name })}
          title={t(STATUS_NAMES[entry.status])}
          onClick={() => toggle(entry)}
        >
          <StatusMark status={entry.status} />
        </button>
      </li>
    );
  };

  return (
    <section
      aria-label={t("Items in route order")}
      className="flex min-h-0 flex-1 flex-col text-sm"
    >
      {wishlist.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-2">
          <input
            className="field w-full"
            type="search"
            aria-label={t("Search the wishlist")}
            placeholder={t("Search English or 中文")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            className="segmented self-start"
            role="group"
            aria-label={t("Show")}
          >
            {(["all", ...WISHLIST_STATUSES] as const).map((status) => (
              <button
                key={status}
                aria-pressed={shown === status}
                onClick={() => setShown(status)}
              >
                {t(status === "all" ? "All" : STATUS_NAMES[status])}
                <span className="ml-1.5 text-[11px] opacity-70">
                  {status === "all" ? wishlist.length : counts[status]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="min-h-0 overflow-y-auto px-4 pb-2">
        {wishlist.length === 0 ? (
          <p className="text-muted">
            {unpinned.length
              ? t(
                  "No wishlist items are at a pin yet. Attach them from a pin's Items.",
                )
              : t("The wishlist is empty.")}
          </p>
        ) : (
          !route.length &&
          !off.length && (
            <p className="py-4 text-muted">{t("No wishlist items match.")}</p>
          )
        )}
        <ul>{route.map((r) => row(r.entry, r.step))}</ul>
        {off.length > 0 && (
          <>
            <h4 className="label pt-2">{t("Not on the route yet")}</h4>
            <ul>{off.map((r) => row(r.entry))}</ul>
          </>
        )}
      </div>
    </section>
  );
}

function StatusMark({ status }: { status: WishlistItem["status"] }) {
  if (status === "acquired")
    return (
      <svg width={20} height={20} viewBox="0 0 18 18" aria-hidden="true">
        <circle cx={9} cy={9} r={8} className="fill-sage" />
        <path
          d="M5 9.2 l2.6 2.6 L13 6.4"
          fill="none"
          className="stroke-ink"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 18 18"
      aria-hidden="true"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      className={status === "skipped" ? "stroke-muted" : "stroke-gold"}
    >
      <circle cx={9} cy={9} r={7} />
      {status === "skipped" && <path d="M5 13 L13 5" />}
    </svg>
  );
}
