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
import { isGameGrace, replaceWithGrace } from "./graces";
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
  /** Playthrough controls for the selected node: progress and wishlist. */
  nodeControls(node: MapNode): ReactNode;
};

export function Inspector(props: Props) {
  const { t, doc, selection, layer } = props;
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
          <Summary t={t} doc={doc} layer={layer} />
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
  nodeControls,
}: Props & { node: MapNode }) {
  const [query, setQuery] = useState("");
  // Game graces are game data: they can be visited and joined by paths, not edited.
  const fixed = isGameGrace(node.id);
  const candidates = fixed ? [] : refCandidates(data, node.kind);
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
  // A hand-placed grace is replaced by the game grace it stands for.
  const pick = (id: string) => {
    if (node.kind !== "grace") return update({ ref: id });
    edit(replaceWithGrace(doc, node.id, id));
    select({ kind: "node", id });
  };
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

      {!fixed && (
        <label className="block space-y-1">
          <span className="label">{t("Kind")}</span>
          <select
            className="field w-full"
            value={node.kind}
            onChange={(e) =>
              update({ kind: e.target.value as NodeKind, ref: null })
            }
          >
            {NODE_KINDS.filter(
              (kind) => kind !== "grace" || node.kind === "grace",
            ).map((kind) => (
              <option key={kind} value={kind}>
                {t(NODE_KIND_NAMES[kind])}
              </option>
            ))}
          </select>
        </label>
      )}

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
                      pick(result.id);
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

      {nodeControls(node)}

      {!fixed && (
        <label className="block space-y-1">
          <span className="label">{t("Your note")}</span>
          <input
            className="field w-full"
            value={node.label}
            placeholder={t("Shown when no name is linked")}
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>
      )}

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
      {!fixed && (
        <button className="chip chip--danger" onClick={deleteSelection}>
          {t("Delete node")}
        </button>
      )}
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
}: {
  t: Translate;
  doc: MapDocument;
  layer: LayerId;
}) {
  // The player's own nodes; game graces are on every map.
  const here = doc.nodes.filter((n) => n.layer === layer && !isGameGrace(n.id));
  const ids = new Set(here.map((n) => n.id));
  return (
    <section className="space-y-4 text-sm">
      <h2 className="font-serif text-lg text-gold">{t(LAYER_NAMES[layer])}</h2>
      <p className="text-muted">
        {t("{nodes} nodes and {edges} paths on this layer.", {
          nodes: here.length,
          edges: doc.edges.filter((e) => ids.has(e.from) || ids.has(e.to))
            .length,
        })}
      </p>
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
