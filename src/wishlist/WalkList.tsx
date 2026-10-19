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
import {
  iconUrl,
  isItem,
  type CatalogBoss,
  type GameData,
} from "../map/catalog";
import { BOSS_SYMBOL } from "../map/style";
import { activeProfile } from "../profiles/profiles";
import { beatenBosses, setFlag } from "../progress/progress";
import { STATUS_NAMES, pinName } from "./WishlistPanel";
import {
  combinedWishlist,
  countByStatus,
  playthroughOrder,
  updateWishlistItem,
  type PinnedEntry,
  type TrackerRow,
} from "./wishlist";

/** A tracker row; an entry on no walked path has no step. */
type Row =
  | TrackerRow
  | { kind: "item"; entry: PinnedEntry; pin: string; step?: undefined };

const fold = (text: string) => text.normalize("NFKC").toLowerCase();

/**
 * The playthrough tracker: what the walk reaches, in walking order, with
 * tap-to-mark progress. Each wishlist entry at a pin is acquired or not; each
 * boss at a pin a walked path reaches is beaten or not, by its game flag.
 * Entries not attached to a pin aren't shown. A search box and a status
 * filter narrow what's shown; a beaten boss counts as done, like an acquired
 * item.
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
  const { onRoute, offRoute } = playthroughOrder(doc, wishlist);
  const counts = countByStatus(wishlist);
  const beaten = beatenBosses(data, profile.progress);
  const bosses = onRoute.flatMap((r) => (r.kind === "boss" ? [r.boss] : []));
  const bossesBeaten = bosses.filter((b) => beaten.has(b)).length;
  const shownCounts: Record<WishlistStatus | "all", number> = {
    all: wishlist.length + bosses.length,
    needed: counts.needed + bosses.length - bossesBeaten,
    acquired: counts.acquired + bossesBeaten,
    skipped: counts.skipped,
  };
  /** A boss's progress reads as an item's: beaten is acquired. */
  const statusOf = (row: Row): WishlistStatus =>
    row.kind === "item"
      ? row.entry.status
      : beaten.has(row.boss)
        ? "acquired"
        : "needed";
  // Tapping marks an item acquired, or a boss beaten; tapping again undoes it.
  const toggle = (row: Row) => {
    if (row.kind === "item")
      return setPlayer(
        updateWishlistItem(player, profile.id, row.entry.item, row.pin, {
          status: row.entry.status === "acquired" ? "needed" : "acquired",
        }),
      );
    const boss = data.byId.get(row.boss) as CatalogBoss | undefined;
    if (boss)
      setPlayer(setFlag(player, profile.id, boss.flag, !beaten.has(row.boss)));
  };
  const where = (pin: string) => pinName(t, language, data, doc, pin);
  // A row matches by its name in either language, its pin's name or its note.
  const q = fold(query.trim());
  const matches = (row: Row) => {
    if (shown !== "all" && statusOf(row) !== shown) return false;
    if (!q) return true;
    const id = row.kind === "item" ? row.entry.item : row.boss;
    const entry = data.byId.get(id);
    const note = row.kind === "item" ? row.entry.note : "";
    return [entry?.name.en, entry?.name["zh-TW"], where(row.pin), note].some(
      (text) => text && fold(text).includes(q),
    );
  };
  const route = onRoute.filter(matches);
  const off = offRoute
    .map((r): Row => ({ kind: "item", ...r }))
    .filter(matches);

  const row = (r: Row) => {
    const id = r.kind === "item" ? r.entry.item : r.boss;
    const item = data.byId.get(id);
    const name = item?.name[language] ?? id;
    const status = statusOf(r);
    const place =
      r.step === undefined
        ? t("{place} · not on a path yet", { place: where(r.pin) })
        : where(r.pin);
    return (
      <li key={`${r.pin} ${id}`} className="flex items-center gap-2">
        <span
          className={`grid h-5 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${r.step === undefined ? "border border-dashed border-line text-muted" : "bg-gold text-ink"}`}
        >
          {r.step ?? "–"}
        </span>
        <button
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => showNode(r.pin)}
        >
          {r.kind === "boss" ? (
            <span
              className="grid size-8 shrink-0 place-items-center rounded bg-ink text-danger [&>svg]:size-5"
              dangerouslySetInnerHTML={{ __html: BOSS_SYMBOL }}
            />
          ) : (
            item &&
            isItem(item) &&
            item.icon && (
              <img
                src={iconUrl(item.icon)}
                alt=""
                className="size-8 shrink-0 rounded bg-ink"
                loading="lazy"
              />
            )
          )}
          <span className="flex min-w-0 flex-col">
            <span
              className={`truncate ${status === "needed" ? "" : "text-muted line-through"}`}
            >
              {name}
            </span>
            <span className="truncate text-xs text-muted">{place}</span>
          </span>
        </button>
        <button
          className="grid size-11 shrink-0 place-items-center"
          aria-pressed={status === "acquired"}
          aria-label={
            r.kind === "item"
              ? t("{item}: acquired", { item: name })
              : t("{boss}: beaten", { boss: name })
          }
          title={
            r.kind === "item"
              ? t(STATUS_NAMES[status])
              : t(status === "acquired" ? "Beaten" : "Not beaten")
          }
          onClick={() => toggle(r)}
        >
          <StatusMark status={status} />
        </button>
      </li>
    );
  };

  return (
    <section
      aria-label={t("Playthrough tracker")}
      className="flex min-h-0 flex-1 flex-col text-sm"
    >
      {shownCounts.all > 0 && (
        <div className="flex flex-col gap-2 px-4 pb-2">
          <input
            className="field w-full"
            type="search"
            aria-label={t("Search the playthrough")}
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
                  {shownCounts[status]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="min-h-0 overflow-y-auto px-4 pb-2">
        {shownCounts.all === 0 ? (
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
            <p className="py-4 text-muted">{t("Nothing matches.")}</p>
          )
        )}
        <ul>{route.map(row)}</ul>
        {off.length > 0 && (
          <>
            <h4 className="label pt-2">{t("Not on the route yet")}</h4>
            <ul>{off.map(row)}</ul>
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
