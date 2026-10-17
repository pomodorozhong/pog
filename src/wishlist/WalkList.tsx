import type {
  Language,
  MapDocument,
  PlayerDocument,
  WishlistItem,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import { iconUrl, isItem, type GameData } from "../map/catalog";
import { activeProfile } from "../profiles/profiles";
import { STATUS_NAMES } from "./WishlistPanel";
import { countByStatus, updateWishlistItem, walkOrder } from "./wishlist";

/** The wishlist in the order the walk reaches each item, with tap-to-mark status. */
export function WalkList({
  t,
  language,
  data,
  player,
  setPlayer,
  doc,
  showNode,
  heading = true,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
  doc: MapDocument;
  showNode(id: string): void;
  /** Off when the surrounding panel already names the list. */
  heading?: boolean;
}) {
  const profile = activeProfile(player);
  const { onRoute, offRoute } = walkOrder(doc, profile.wishlist);
  const counts = countByStatus(profile.wishlist);
  // Tapping marks an item acquired; tapping an acquired item marks it needed again.
  const toggle = (entry: WishlistItem) =>
    setPlayer(
      updateWishlistItem(player, profile.id, entry.item, {
        status: entry.status === "acquired" ? "needed" : "acquired",
      }),
    );

  const row = (entry: WishlistItem, pin: string | null, step?: number) => {
    const item = data.byId.get(entry.item);
    const name = item?.name[language] ?? entry.item;
    return (
      <li key={entry.item} className="flex items-center gap-2">
        <span
          className={`grid h-5 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step === undefined ? "border border-dashed border-line text-muted" : "bg-gold text-ink"}`}
        >
          {step ?? "–"}
        </span>
        <button
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
          disabled={!pin}
          onClick={() => pin && showNode(pin)}
        >
          {item && isItem(item) && item.icon && (
            <img
              src={iconUrl(item.icon)}
              alt=""
              className="size-8 shrink-0 rounded bg-ink"
              loading="lazy"
            />
          )}
          <span
            className={`min-w-0 truncate ${entry.status === "needed" ? "" : "text-muted line-through"}`}
          >
            {name}
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
      className="space-y-1 text-sm"
    >
      {heading && (
        <h3 className="label flex items-baseline">
          {t("Items in route order")}
          <span className="ml-auto normal-case tracking-normal">
            {t("{acquired} of {total} acquired", {
              acquired: counts.acquired,
              total: profile.wishlist.length,
            })}
          </span>
        </h3>
      )}
      {profile.wishlist.length === 0 && (
        <p className="text-muted">{t("The wishlist is empty.")}</p>
      )}
      <ul>{onRoute.map((r) => row(r.entry, r.pin, r.step))}</ul>
      {offRoute.length > 0 && (
        <>
          <h4 className="label pt-2">{t("Not on the route yet")}</h4>
          <ul>{offRoute.map((r) => row(r.entry, r.pin))}</ul>
        </>
      )}
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
