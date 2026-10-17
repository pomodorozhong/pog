import type { Language, MapDocument } from "../domain/types";
import type { Translate } from "../i18n/translation";
import { displayName, iconUrl, isItem, type GameData } from "../map/catalog";
import { NODE_KIND_NAMES } from "../map/labels";
import type { RoutePlan } from "./usePlannedRoute";

/** "Next stops": the planned route, stop by stop. */
export function RoutePanel({
  t,
  language,
  data,
  doc,
  plan,
  showNode,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  doc: MapDocument;
  plan: RoutePlan | null;
  showNode(id: string): void;
}) {
  const name = (id: string) => {
    const node = doc.nodes.find((n) => n.id === id);
    return node
      ? displayName(data, node, language) || t(NODE_KIND_NAMES[node.kind])
      : id;
  };
  const { route } = plan ?? {};
  return (
    <section className="space-y-2 text-sm" aria-label={t("Next stops")}>
      <h3 className="label">{t("Next stops")}</h3>
      {!plan || !route ? (
        <p className="text-xs text-muted">
          {t("Set your position to plan the route.")}
        </p>
      ) : !route.order.length && !route.unreachable.length ? (
        <p className="text-xs text-muted">
          {t(
            "No stops yet: needed wishlist items show up here once they have a pin on the map.",
          )}
        </p>
      ) : (
        <>
          {route.order.length > 0 && (
            <p className="text-muted">
              {route.order.length === 1
                ? t("1 stop")
                : t("{count} stops", { count: route.order.length })}
            </p>
          )}
          <ol className="space-y-1">
            {route.order.map((stop, i) => {
              const leg = route.legs[i];
              const node = doc.nodes.find((n) => n.id === stop);
              const entry = node?.ref ? data.byId.get(node.ref) : undefined;
              const travel = leg.find((s) => s.via.kind === "fast-travel");
              const notes = [
                travel &&
                  t("fast travel to {grace}", { grace: name(travel.to) }),
                leg.some((s) => s.via.kind === "guess") && t("path is a guess"),
              ].filter(Boolean);
              return (
                <li key={stop} className="flex items-start gap-2">
                  <span className="stop-number">{i + 1}</span>
                  {entry && isItem(entry) && entry.icon && (
                    <img
                      src={iconUrl(entry.icon)}
                      alt=""
                      className="size-6"
                      loading="lazy"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <button
                      className="link block text-left"
                      onClick={() => showNode(stop)}
                    >
                      {name(stop)}
                    </button>
                    {notes.length > 0 && (
                      <span className="block text-xs text-muted">
                        {notes.join(" · ")}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {route.unreachable.length > 0 && (
            <p className="text-xs text-danger">
              {t("Can't reach: {stops}", {
                stops: route.unreachable.map(name).join(", "),
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
