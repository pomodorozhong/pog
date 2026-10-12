import { useState, type ReactNode } from "react";
import {
  EDGE_TYPES,
  NODE_KINDS,
  type EdgeType,
  type Language,
  type LayerId,
  type MapDocument,
  type MapNode,
  type NodeKind,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import {
  displayName,
  iconUrl,
  isItem,
  refCandidates,
  searchCatalog,
  type GameData,
} from "./catalog";
import type { MapAction } from "./editing";
import { importGraces } from "./graces";
import type { Selection } from "./MapCanvas";
import { EDGE_NAMES, LAYER_NAMES, NODE_KIND_NAMES } from "./labels";
import { EDGE_STYLE } from "./style";

type Props = {
  t: Translate;
  language: Language;
  data: GameData;
  doc: MapDocument;
  selection: Selection;
  layer: LayerId;
  edit(action: MapAction): void;
  select(selection: Selection): void;
  showNode(id: string): void;
  deleteSelection(): void;
  recovery?: string;
  /** Shown above the layer summary when nothing is selected. */
  profile: ReactNode;
  /** Wishlist control for the item an item pin is linked to. */
  pinWishlist(item: string): ReactNode;
};

export function Inspector(props: Props) {
  const { t, doc, selection, data, layer } = props;
  const node =
    selection?.kind === "node"
      ? doc.nodes.find((n) => n.id === selection.id)
      : undefined;
  const edge =
    selection?.kind === "edge"
      ? doc.edges.find((e) => e.id === selection.id)
      : undefined;
  return (
    <aside className="flex max-h-[45vh] w-full flex-col gap-4 overflow-y-auto border-t border-line bg-panel p-4 md:max-h-none md:w-80 md:border-t-0 md:border-l">
      {props.recovery !== undefined && (
        <div className="rounded border border-danger/60 p-2 text-sm">
          <p>
            {t(
              "Saved data could not be loaded. Original data is preserved; changes stay in memory.",
            )}
          </p>
          <a
            className="text-gold underline"
            download="route-of-grace-original.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(props.recovery)}`}
          >
            {t("Download original saved data")}
          </a>
        </div>
      )}
      {node ? (
        <NodePanel {...props} node={node} key={node.id} />
      ) : edge ? (
        <EdgePanel {...props} edgeId={edge.id} key={edge.id} />
      ) : (
        <>
          {props.profile}
          <Summary
            t={t}
            doc={doc}
            layer={layer}
            data={data}
            edit={props.edit}
          />
        </>
      )}
    </aside>
  );
}

function NodePanel({
  t,
  language,
  data,
  doc,
  node,
  edit,
  select,
  deleteSelection,
  pinWishlist,
}: Props & { node: MapNode }) {
  const [query, setQuery] = useState("");
  const candidates = refCandidates(data, node.kind);
  const results = query
    ? searchCatalog(candidates, query)
    : !node.ref && node.kind === "grace"
      ? nearbyGraces(data, node)
      : [];
  const entry = node.ref ? data.byId.get(node.ref) : undefined;
  const connected = doc.edges.filter(
    (e) => e.from === node.id || e.to === node.id,
  );
  const update = (changes: Partial<MapNode>) =>
    edit({ type: "updateNode", id: node.id, changes });
  const other = language === "en" ? "zh-TW" : "en";

  return (
    <section className="space-y-4" aria-label={t("Selected node")}>
      <header className="flex items-start gap-3">
        {entry && isItem(entry) && entry.icon && (
          <img
            src={iconUrl(entry.icon)}
            alt=""
            className="size-14 rounded bg-ink"
          />
        )}
        <div className="min-w-0">
          <h2 className="font-serif text-lg text-gold">
            {displayName(data, node, language) || t(NODE_KIND_NAMES[node.kind])}
          </h2>
          {entry && <p className="text-sm text-muted">{entry.name[other]}</p>}
        </div>
      </header>

      <label className="block space-y-1">
        <span className="label">{t("Kind")}</span>
        <select
          className="field w-full"
          value={node.kind}
          onChange={(e) =>
            update({ kind: e.target.value as NodeKind, ref: null })
          }
        >
          {NODE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(NODE_KIND_NAMES[kind])}
            </option>
          ))}
        </select>
      </label>

      {candidates.length > 0 && (
        <div className="space-y-1">
          <label className="label" htmlFor="ref-search">
            {node.kind === "item"
              ? t("Item")
              : node.kind === "grace"
                ? t("Site of Grace")
                : t("Place name")}
          </label>
          {entry && (
            <p className="flex items-center justify-between gap-2 text-sm">
              <span>{entry.name[language]}</span>
              <button className="link" onClick={() => update({ ref: null })}>
                {t("Unlink")}
              </button>
            </p>
          )}
          <input
            id="ref-search"
            className="field w-full"
            autoFocus={!entry}
            placeholder={t("Search English or 中文")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query && results.length > 0 && (
            <p className="text-xs text-muted">{t("Nearby graces")}</p>
          )}
          {results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto rounded border border-line">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-ink"
                    onClick={() => {
                      update({ ref: result.id });
                      setQuery("");
                    }}
                  >
                    {isItem(result) && result.icon && (
                      <img
                        src={iconUrl(result.icon)}
                        alt=""
                        className="size-8"
                        loading="lazy"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate">
                        {result.name[language]}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {result.name[other]}
                        {result.dlc && ` · ${t("DLC")}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {node.kind === "item" && node.ref && pinWishlist(node.ref)}

      <label className="block space-y-1">
        <span className="label">{t("Your note")}</span>
        <input
          className="field w-full"
          value={node.label}
          placeholder={t("Shown when no name is linked")}
          onChange={(e) => update({ label: e.target.value })}
        />
      </label>

      <div className="space-y-1">
        <h3 className="label">
          {t("Paths ({count})", { count: connected.length })}
        </h3>
        <ul className="space-y-1 text-sm">
          {connected.map((e) => {
            const otherEnd = doc.nodes.find(
              (n) => n.id === (e.from === node.id ? e.to : e.from),
            );
            return (
              <li key={e.id}>
                <button
                  className="link text-left"
                  onClick={() => select({ kind: "edge", id: e.id })}
                >
                  <span
                    className="swatch"
                    style={{ background: EDGE_STYLE[e.type].color }}
                  />{" "}
                  {t(EDGE_NAMES[e.type])} →{" "}
                  {(otherEnd && displayName(data, otherEnd, language)) ||
                    t(NODE_KIND_NAMES[otherEnd?.kind ?? "junction"])}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-muted">
        {t(LAYER_NAMES[node.layer])} · {node.x}, {node.y}
      </p>
      <button className="chip chip--danger" onClick={deleteSelection}>
        {t("Delete node")}
      </button>
    </section>
  );
}

function EdgePanel({
  t,
  language,
  data,
  doc,
  edgeId,
  edit,
  showNode,
  deleteSelection,
}: Props & { edgeId: string }) {
  const edge = doc.edges.find((e) => e.id === edgeId)!;
  const ends = [edge.from, edge.to].map((id) =>
    doc.nodes.find((n) => n.id === id)!,
  );
  const crossesLayers = ends[0].layer !== ends[1].layer;
  const update = (changes: {
    type?: EdgeType;
    note?: string;
    points?: [number, number][];
  }) => edit({ type: "updateEdge", id: edge.id, changes });

  return (
    <section className="space-y-4" aria-label={t("Selected path")}>
      <h2 className="font-serif text-lg text-gold">
        {t(EDGE_NAMES[edge.type])}
      </h2>
      <ol className="space-y-1 text-sm">
        {ends.map((end, index) => (
          <li key={end.id}>
            <span className="text-muted">
              {index === 0 ? t("From") : t("To")}{" "}
            </span>
            <button className="link" onClick={() => showNode(end.id)}>
              {displayName(data, end, language) || t(NODE_KIND_NAMES[end.kind])}
            </button>
            {crossesLayers && (
              <span className="text-muted"> · {t(LAYER_NAMES[end.layer])}</span>
            )}
          </li>
        ))}
      </ol>
      <label className="block space-y-1">
        <span className="label">{t("Path type")}</span>
        <select
          className="field w-full"
          value={edge.type}
          onChange={(e) => update({ type: e.target.value as EdgeType })}
        >
          {EDGE_TYPES.filter(
            (type) => !crossesLayers || type === "waygate",
          ).map((type) => (
            <option key={type} value={type}>
              {t(EDGE_NAMES[type])}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="label">{t("Your note")}</span>
        <input
          className="field w-full"
          value={edge.note}
          placeholder={t("For example the key or boss this path needs")}
          onChange={(e) => update({ note: e.target.value })}
        />
      </label>
      <p className="text-xs text-muted">
        {t("{count} waypoints", { count: edge.points.length })}
      </p>
      <div className="flex gap-2">
        {edge.points.length > 0 && (
          <button className="chip" onClick={() => update({ points: [] })}>
            {t("Straighten")}
          </button>
        )}
        <button className="chip chip--danger" onClick={deleteSelection}>
          {t("Delete path")}
        </button>
      </div>
    </section>
  );
}

/** The closest game graces to a hand-placed grace, nearest first. */
function nearbyGraces(data: GameData, node: MapNode) {
  return data.catalog.graces
    .filter((g) => g.layer === node.layer)
    .map((g) => ({ g, d: Math.hypot(g.x - node.x, g.y - node.y) }))
    .filter(({ d }) => d < 400)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .map(({ g }) => g);
}

function Summary({
  t,
  doc,
  layer,
  data,
  edit,
}: {
  t: Translate;
  doc: MapDocument;
  layer: LayerId;
  data: GameData;
  edit(action: MapAction): void;
}) {
  const here = doc.nodes.filter((n) => n.layer === layer);
  const total = data.catalog.graces.filter((g) => g.layer === layer).length;
  const plan = importGraces(data.catalog.graces, doc, layer);
  const pending = plan.type === "batch" ? plan.actions.length : 0;
  return (
    <section className="space-y-4 text-sm">
      <h2 className="font-serif text-lg text-gold">{t(LAYER_NAMES[layer])}</h2>
      <p className="text-muted">
        {t("{nodes} nodes and {edges} paths on this layer.", {
          nodes: here.length,
          edges: doc.edges.filter((e) => here.some((n) => n.id === e.from))
            .length,
        })}
      </p>
      {total > 0 && (
        <div className="space-y-2">
          <h3 className="label">{t("Sites of Grace")}</h3>
          {pending > 0 ? (
            <>
              <p className="text-muted">
                {t(
                  "The game has {total} graces on this layer. Graces you placed by hand are linked to the nearest one and keep their position.",
                  { total },
                )}
              </p>
              <button className="chip" onClick={() => edit(plan)}>
                {t("Add graces from the game ({count})", { count: pending })}
              </button>
            </>
          ) : (
            <p className="text-muted">
              {t("Every grace on this layer is on the map.")}
            </p>
          )}
        </div>
      )}
      <div>
        <h3 className="label mb-1">{t("Path types")}</h3>
        <ul className="space-y-1">
          {EDGE_TYPES.map((type) => (
            <li key={type} className="flex items-center gap-2">
              <svg width="28" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  stroke={EDGE_STYLE[type].color}
                  strokeWidth="3"
                  strokeDasharray={EDGE_STYLE[type].dashArray}
                />
              </svg>
              {t(EDGE_NAMES[type])}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
