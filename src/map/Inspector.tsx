import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  NODE_KINDS,
  PATH_COLORS,
  pinItems,
  PATH_LINES,
  entrancePlace,
  type Language,
  type LayerId,
  type MapDocument,
  type MapEdge,
  type MapNode,
  type NodeKind,
  type WalkedPath,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import {
  displayName,
  iconUrl,
  isItem,
  nearestGrace,
  refCandidates,
  searchCatalog,
  type CatalogBoss,
  type CatalogItem,
  type CatalogName,
  type GameData,
} from "./catalog";
import {
  inStepOrder,
  layerCounts,
  newId,
  newPath,
  notePath,
  type EdgeChanges,
  type MapAction,
} from "./editing";
import { CloseIcon } from "../layout/icons";
import { isGameGrace } from "./graces";
import type { Selection } from "./MapCanvas";
import { LAYER_NAMES, NODE_KIND_NAMES, PATH_COLOR_NAMES } from "./labels";
import { PATH_COLOR, pathStyle } from "./style";

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
  /** Point out a path on the map, or stop (null). */
  highlight(id: string | null): void;
  /** Go on drawing a path from its last pin. */
  extendPath(id: string): void;
  deleteSelection(): void;
  recovery?: string;
  /** Shown above the layer summary when nothing is selected. */
  profile: ReactNode;
  /** Actions on this map, in its card when nothing is selected. */
  mapActions?: ReactNode;
  /** Shown last when nothing is selected. */
  profileActions?: ReactNode;
  /** Playthrough controls for the selected node, such as its progress. */
  nodeControls(node: MapNode): ReactNode;
  /** Playthrough controls for an item at the selected node: its wishlist entry. */
  itemControls(node: MapNode, item: string): ReactNode;
  /**
   * Wishlist entries not attached to a pin, to choose from beside the
   * catalog search. `addItem` puts an item on the selected node.
   */
  unpinnedItems(node: MapNode, addItem: (item: string) => void): ReactNode;
  /** Catalog ids of the bosses beaten in this playthrough. */
  beaten: Set<string>;
};

export function Inspector(props: Props) {
  const { t, doc, selection, layer } = props;
  const node =
    selection?.kind === "node"
      ? doc.nodes.find((n) => n.id === selection.id)
      : undefined;
  const edge =
    selection?.kind === "edge"
      ? inStepOrder(doc.edges).find((e) => e.id === selection.id)
      : undefined;
  return (
    <aside className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-1 pb-4">
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
          <Summary t={t} doc={doc} layer={layer}>
            {props.mapActions}
          </Summary>
          {props.profileActions}
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
  itemControls,
  unpinnedItems,
  beaten,
}: Props & { node: MapNode }) {
  // Game graces are game data: they hold what a pin does, but can't be moved,
  // deleted or given another kind.
  const fixed = isGameGrace(node.id);
  // Older maps' item pins read as junctions that hold their item.
  const kind: NodeKind = node.kind === "item" ? "junction" : node.kind;
  const items = pinItems(node);
  const entry = node.ref ? data.byId.get(node.ref) : undefined;
  const place = entrancePlace(node);
  const placeEntry = place ? data.byId.get(place) : undefined;
  // A grace is an entrance once its place is linked; until then, while picking one.
  const [graceEntrance, setGraceEntrance] = useState(place !== null);
  const shownKind = fixed ? (graceEntrance ? "entrance" : "grace") : kind;
  const setPlace = (id: string | null) =>
    update(fixed ? { place: id ?? "" } : { ref: id });
  const icon = [entry, ...items.map((id) => data.byId.get(id))].find(
    (e) => e && isItem(e) && e.icon,
  );
  const connected = inStepOrder(
    doc.edges.filter((e) => e.nodes.includes(node.id)),
  );
  const note = notePath(doc, node.id);
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  const update = (changes: Partial<MapNode>) =>
    edit({ type: "updateNode", id: node.id, changes });
  const setItems = (next: string[]) =>
    update(
      node.kind === "item"
        ? { kind: "junction", ref: null, items: next }
        : { items: next },
    );
  // The note lives on the pin's note path, made when needed and removed when empty.
  const setNote = (changes: { note?: string; showNote?: boolean }) => {
    const next = {
      note: note?.note ?? "",
      showNote: note?.showNote ?? false,
      ...changes,
    };
    if (!note)
      edit({
        type: "addEdge",
        edge: { ...newPath(newId("note"), [node.id]), ...next },
      });
    else if (!next.note && !next.showNote)
      edit({ type: "removeEdge", id: note.id });
    else edit({ type: "updateEdge", id: note.id, changes: next });
  };
  const other = language === "en" ? "zh-TW" : "en";

  const kinds = NODE_KINDS.filter((k) =>
    fixed ? k === "grace" || k === "entrance" : k !== "grace" && k !== "item",
  );
  const pickKind = (next: NodeKind) => {
    if (fixed) {
      setGraceEntrance(next === "entrance");
      if (next === "grace") setPlace(null);
    } else
      update({
        kind: next,
        ref: null,
        ...(node.kind === "item" && { items }),
      });
  };

  return (
    <section className="space-y-3" aria-label={t("Selected node")}>
      {/* One height for every node, so switching between a pin and a grace
          doesn't move the fields below. Each line is cut short to fit. */}
      <header className="flex h-17 items-start gap-3 px-1">
        {icon && isItem(icon) && (
          <img
            src={iconUrl(icon.icon!)}
            alt=""
            className="size-14 shrink-0 rounded-lg bg-ink"
          />
        )}
        <div className="min-w-0 flex-1">
          <HeaderLine className="font-serif text-lg text-gold" as="h2">
            {displayName(data, node, language) || t(NODE_KIND_NAMES[kind])}
          </HeaderLine>
          <HeaderLine className="text-sm text-muted">
            {entry?.name[other]}
          </HeaderLine>
          {fixed && (
            <HeaderLine className="text-sm">
              {[
                node.label,
                placeEntry &&
                  t("Entrance to {place}", {
                    place: placeEntry.name[language],
                  }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </HeaderLine>
          )}
        </div>
        <CloseButton t={t} onClick={() => select(null)} />
      </header>

      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <div className="segmented" role="group" aria-label={t("Kind")}>
          {kinds.map((k) => (
            <button
              key={k}
              aria-pressed={shownKind === k}
              onClick={() => pickKind(k)}
            >
              {t(NODE_KIND_NAMES[k])}
            </button>
          ))}
        </div>
        {nodeControls(node)}
      </div>

      {shownKind === "entrance" && (
        <section className="card space-y-2" aria-label={t("Place name")}>
          <h3 className="label">{t("Place name")}</h3>
          {placeEntry && (
            <p className="flex items-center justify-between gap-2 text-sm">
              <span>{placeEntry.name[language]}</span>
              <button className="link" onClick={() => setPlace(null)}>
                {t("Unlink")}
              </button>
            </p>
          )}
          <CatalogSearch
            t={t}
            language={language}
            label={t("Place name")}
            entries={refCandidates(data, "entrance")}
            autoFocus={!placeEntry}
            pick={setPlace}
          />
        </section>
      )}

      <section className="card space-y-2" aria-label={t("Items")}>
        <h3 className="label">
          {t("Items ({count})", { count: items.length })}
        </h3>
        {items.map((id) => {
          const item = data.byId.get(id);
          const name = item?.name[language] ?? id;
          return (
            <div key={id} className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm">
                {item && isItem(item) && item.icon && (
                  <img
                    src={iconUrl(item.icon)}
                    alt=""
                    className="size-8 rounded bg-ink"
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <button
                  className="grid size-7 place-items-center rounded-full text-muted hover:text-danger"
                  aria-label={t("Remove {item}", { item: name })}
                  title={t("Remove")}
                  onClick={() => setItems(items.filter((i) => i !== id))}
                >
                  <CloseIcon />
                </button>
              </p>
              {itemControls(node, id)}
            </div>
          );
        })}
        <CatalogSearch
          t={t}
          language={language}
          label={t("Add an item")}
          placeholder={t("Add an item · English or 中文")}
          adding
          entries={refCandidates(data, "item").filter(
            (e) => !items.includes(e.id),
          )}
          pick={(id) => setItems([...items, id])}
        />
        {unpinnedItems(node, (id) => {
          if (!items.includes(id)) setItems([...items, id]);
        })}
      </section>

      <BossList
        t={t}
        language={language}
        data={data}
        bosses={node.bosses ?? []}
        beaten={beaten}
        setBosses={(bosses) => update({ bosses })}
      />

      <section className="card space-y-2" aria-label={t("Label and note")}>
        <label className="block">
          <span className="label">{t("Label")}</span>
          <input
            className="inline-field"
            value={node.label}
            placeholder={
              fixed
                ? t("Shown beside the grace's name")
                : t("Shown when no name is linked")
            }
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>
        <label className="block border-t border-[#22352e] pt-2">
          <span className="label">{t("Your note")}</span>
          <textarea
            className="inline-field resize-none"
            rows={2}
            value={note?.note ?? ""}
            placeholder={t("For example what to do or remember here")}
            onChange={(e) => setNote({ note: e.target.value })}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm text-text/85">
          {t("Show note on the map")}
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={note?.showNote ?? false}
            onChange={(e) => setNote({ showNote: e.target.checked })}
          />
        </label>
      </section>

      {connected.length > 0 && (
        <section className="card space-y-1 px-2" aria-label={t("Paths")}>
          <h3 className="label px-1.5">
            {t("Paths through here ({count})", { count: connected.length })}
          </h3>
          <ul className="text-sm">
            {connected.map((e) => {
              // Where the path could be split here: a pin that isn't an end.
              const at = e.nodes.findIndex(
                (id, i) => id === node.id && i > 0 && i < e.nodes.length - 1,
              );
              return (
                <li key={e.id} className="flex items-center gap-1">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-text/5"
                    onClick={() => select({ kind: "edge", id: e.id })}
                  >
                    <span
                      className="grid h-5.5 min-w-6.5 shrink-0 place-items-center rounded-full border-2 bg-ink px-1.5 text-xs font-bold"
                      style={{
                        borderColor: PATH_COLOR[e.color],
                        color: PATH_COLOR[e.color],
                      }}
                    >
                      {e.step}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {pathEnds(t, language, data, nodes, e)}
                    </span>
                  </button>
                  {at > 0 && (
                    <button
                      className="chip shrink-0 px-2.5 text-xs"
                      onClick={() =>
                        edit({
                          type: "splitEdge",
                          id: e.id,
                          at,
                          newId: newId("path"),
                        })
                      }
                    >
                      {t("Split here")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between gap-2 px-1">
        {!fixed ? (
          <button
            className="chip chip--danger text-xs"
            onClick={deleteSelection}
          >
            {t("Delete node")}
          </button>
        ) : (
          <span />
        )}
        <p className="text-[11px] text-muted">
          {t(LAYER_NAMES[node.layer])} · {node.x}, {node.y}
        </p>
      </div>
    </section>
  );
}

/** The × that closes the details of what's selected. */
function CloseButton({ t, onClick }: { t: Translate; onClick(): void }) {
  return (
    <button
      className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:text-gold"
      aria-label={t("Close details")}
      onClick={onClick}
    >
      <CloseIcon />
    </button>
  );
}

/** One line of the node details header, cut short with its full text on hover. */
function HeaderLine({
  as: Tag = "p",
  className,
  children,
}: {
  as?: "h2" | "p";
  className: string;
  children?: string;
}) {
  if (!children) return null;
  return (
    <Tag className={`truncate ${className}`} title={children}>
      {children}
    </Tag>
  );
}

/** The bosses fought at a node, in the player's order. */
function BossList({
  t,
  language,
  data,
  bosses,
  beaten,
  setBosses,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  bosses: string[];
  beaten: Set<string>;
  setBosses(bosses: string[]): void;
}) {
  const move = (from: number, to: number) => {
    const next = [...bosses];
    next.splice(to, 0, ...next.splice(from, 1));
    setBosses(next);
  };
  const near = (entry: CatalogItem | CatalogName) => {
    const grace = nearestGrace(data, entry as CatalogBoss);
    return grace && t("near {place}", { place: grace.name[language] });
  };
  const moveButton =
    "grid size-7 place-items-center rounded-full text-muted hover:text-gold disabled:invisible";
  return (
    <section className="card space-y-2" aria-label={t("Bosses")}>
      <h3 className="label">
        {t("Bosses ({count})", { count: bosses.length })}
      </h3>
      {bosses.map((id, i) => {
        const boss = data.byId.get(id);
        const name = boss?.name[language] ?? id;
        return (
          <p key={id} className="flex items-center gap-1 text-sm">
            <span className="min-w-0 flex-1 truncate" title={name}>
              {name}
            </span>
            {beaten.has(id) && (
              <span className="rounded-full bg-sage/20 px-2 text-xs text-sage">
                {t("Beaten")}
              </span>
            )}
            <button
              className={moveButton}
              aria-label={t("Move {boss} up", { boss: name })}
              title={t("Move up")}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              ↑
            </button>
            <button
              className={moveButton}
              aria-label={t("Move {boss} down", { boss: name })}
              title={t("Move down")}
              disabled={i === bosses.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
            <button
              className="grid size-7 place-items-center rounded-full text-muted hover:text-danger"
              aria-label={t("Remove {item}", { item: name })}
              title={t("Remove")}
              onClick={() => setBosses(bosses.filter((b) => b !== id))}
            >
              <CloseIcon />
            </button>
          </p>
        );
      })}
      <CatalogSearch
        t={t}
        language={language}
        label={t("Add a boss")}
        placeholder={t("Add a boss · English or 中文")}
        adding
        entries={data.catalog.bosses.filter((b) => !bosses.includes(b.id))}
        detail={near}
        pick={(id) => setBosses([...bosses, id])}
      />
    </section>
  );
}

/** A search box over catalog entries, in either language. */
function CatalogSearch({
  t,
  language,
  label,
  entries,
  autoFocus,
  placeholder,
  adding = false,
  detail,
  pick,
}: {
  t: Translate;
  language: Language;
  label: string;
  entries: (CatalogItem | CatalogName)[];
  autoFocus?: boolean;
  placeholder?: string;
  /** Drawn as a slot for one more entry: a dashed pill with a "+". */
  adding?: boolean;
  /** More to tell results apart by, after the other language's name. */
  detail?(entry: CatalogItem | CatalogName): string | undefined;
  pick(id: string): void;
}) {
  const [query, setQuery] = useState("");
  const results = query ? searchCatalog(entries, query) : [];
  const other = language === "en" ? "zh-TW" : "en";
  const input = (
    <input
      className={
        adding
          ? "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          : "field w-full"
      }
      aria-label={label}
      autoFocus={autoFocus}
      placeholder={placeholder ?? t("Search English or 中文")}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
  return (
    <>
      {adding ? (
        <div className="flex h-10 items-center gap-2.5 rounded-full border border-dashed border-[#3a5248] bg-ink/50 px-3 text-sm focus-within:border-gold/60">
          <span
            aria-hidden="true"
            className="grid size-5.5 shrink-0 place-items-center rounded-full bg-gold/20 leading-none text-gold"
          >
            +
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      {results.length > 0 && (
        <ul className="max-h-64 overflow-y-auto rounded-xl border border-line bg-panel">
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
                    {[
                      result.name[other],
                      detail?.(result),
                      result.dlc && t("DLC"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EdgePanel(props: Props & { edgeId: string }) {
  const { t, language, data, doc, edgeId, edit, showNode, deleteSelection } =
    props;
  const [moving, setMoving] = useState(false);
  const walked = inStepOrder(doc.edges);
  const edge = walked.find((e) => e.id === edgeId)!;
  const pins = edge.nodes.map((id) => doc.nodes.find((n) => n.id === id)!);
  const ends = [pins[0], pins[pins.length - 1]];
  const crossesLayers = pins.some((n) => n.layer !== pins[0].layer);
  const update = (changes: EdgeChanges) =>
    edit({ type: "updateEdge", id: edge.id, changes });

  if (moving)
    return <MoveList {...props} edge={edge} close={() => setMoving(false)} />;
  return (
    <section className="space-y-3" aria-label={t("Selected path")}>
      <header className="flex items-center gap-2 px-1">
        <h2 className="min-w-0 flex-1 font-serif text-lg text-gold">
          {t("Step {step}", { step: edge.step })}
        </h2>
        {walked.length > 1 && (
          <button className="chip text-xs" onClick={() => setMoving(true)}>
            {t("Move…")}
          </button>
        )}
        <CloseButton t={t} onClick={() => props.select(null)} />
      </header>
      <ol className="card space-y-1 text-sm">
        {ends.map((end, index) => (
          <li key={index}>
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
      <section className="card space-y-2.5" aria-label={t("Look")}>
        <h3 className="label">{t("Look")}</h3>
        <div className="flex flex-wrap gap-1.5">
          {PATH_COLORS.map((color) => (
            <button
              key={color}
              className="color-pick"
              style={{ background: PATH_COLOR[color] }}
              aria-label={t(PATH_COLOR_NAMES[color])}
              aria-pressed={edge.color === color}
              onClick={() => update({ color })}
            />
          ))}
        </div>
        <div className="segmented" role="group" aria-label={t("Line")}>
          {PATH_LINES.map((line) => (
            <button
              key={line}
              className="flex items-center gap-2"
              aria-pressed={edge.line === line}
              onClick={() => update({ line })}
            >
              <svg width="24" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={PATH_COLOR[edge.color]}
                  strokeWidth="3"
                  strokeDasharray={pathStyle({ ...edge, line }).dashArray}
                />
              </svg>
              {line === "solid" ? t("Solid") : t("Dashed")}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 border-t border-[#22352e] pt-2.5 text-sm text-text/85">
          {t("One way (in drawing order)")}
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={edge.oneWay}
            onChange={(e) => update({ oneWay: e.target.checked })}
          />
        </label>
      </section>
      <section className="card space-y-2" aria-label={t("Your note")}>
        <label className="block">
          <span className="label">{t("Your note")}</span>
          <textarea
            className="inline-field resize-none"
            rows={2}
            value={edge.note}
            placeholder={t("For example the key or boss this path needs")}
            onChange={(e) => update({ note: e.target.value })}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm text-text/85">
          {t("Show note on the map")}
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={edge.showNote}
            onChange={(e) => update({ showNote: e.target.checked })}
          />
        </label>
      </section>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <button
          className="chip text-xs"
          onClick={() => props.extendPath(edge.id)}
        >
          {t("Extend")}
        </button>
        <button className="chip chip--danger text-xs" onClick={deleteSelection}>
          {t("Delete path")}
        </button>
        <p className="ml-auto text-[11px] text-muted">
          {t("Through {count} pins", { count: pins.length })}
        </p>
      </div>
    </section>
  );
}

/** A path by its first and last pins, such as "Stormhill → Junction". */
function pathEnds(
  t: Translate,
  language: Language,
  data: GameData,
  nodes: ReadonlyMap<string, MapNode>,
  edge: MapEdge,
) {
  const name = (id: string) => {
    const node = nodes.get(id);
    return node
      ? displayName(data, node, language) || t(NODE_KIND_NAMES[node.kind])
      : "";
  };
  return `${name(edge.nodes[0])} → ${name(edge.nodes[edge.nodes.length - 1])}`;
}

/** Choose a path's new step from the list of paths in walking order. */
function MoveList({
  t,
  language,
  data,
  doc,
  layer,
  edge,
  edit,
  highlight,
  close,
}: Props & { edge: WalkedPath; close(): void }) {
  const list = useRef<HTMLDivElement>(null);
  const ordered = inStepOrder(doc.edges);
  const at = ordered.findIndex((e) => e.id === edge.id);
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  useEffect(() => {
    list.current
      ?.querySelector("[aria-current]")
      ?.scrollIntoView({ block: "center" });
    return () => highlight(null);
  }, [highlight]);

  // Slot k sits before the k-th path. The two slots next to this path would leave it where it is.
  const slot = (k: number) =>
    k === at || k === at + 1 ? null : (
      <li key={`slot-${k}`}>
        <button
          className="move-slot"
          data-move-item
          onClick={() => {
            edit({ type: "moveEdge", id: edge.id, step: k <= at ? k + 1 : k });
            close();
          }}
        >
          {t("Put here")}
        </button>
      </li>
    );
  // Arrow keys step through the paths and slots; Esc closes without moving.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      return close();
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [
      ...list.current!.querySelectorAll<HTMLElement>("[data-move-item]"),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    items[Math.min(Math.max(next, 0), items.length - 1)]?.focus();
  };

  return (
    <section
      className="flex min-h-0 flex-col gap-3"
      aria-label={t("Move path")}
      onKeyDown={onKeyDown}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg text-gold">
          {t("Move step {step} to…", { step: edge.step })}
        </h2>
        <button className="chip" onClick={close}>
          {t("Done")}
        </button>
      </header>
      <div ref={list} className="min-h-0 overflow-y-auto">
        <ol
          className="space-y-0.5 text-sm"
          onMouseLeave={() => highlight(null)}
        >
          {ordered.map((e, k) => [
            slot(k),
            <li
              key={e.id}
              tabIndex={0}
              data-move-item
              aria-current={e.id === edge.id ? "true" : undefined}
              className={`move-row ${e.id === edge.id ? "is-moving" : ""}`}
              onMouseEnter={() => highlight(e.id)}
              onFocus={() => highlight(e.id)}
            >
              <span className="w-7 shrink-0 text-right text-muted">
                {e.step}
              </span>
              <span
                className="swatch shrink-0"
                style={{ background: PATH_COLOR[e.color] }}
              />
              <span className="min-w-0 flex-1 truncate">
                {pathEnds(t, language, data, nodes, e)}
              </span>
              {nodes.get(e.nodes[0])?.layer !== layer && (
                <span className="shrink-0 text-xs text-muted">
                  {t(LAYER_NAMES[nodes.get(e.nodes[0])!.layer])}
                </span>
              )}
            </li>,
          ])}
          {slot(ordered.length)}
        </ol>
      </div>
    </section>
  );
}

/** This map's card: what's drawn on the shown layer, and actions on the map. */
function Summary({
  t,
  doc,
  layer,
  children,
}: {
  t: Translate;
  doc: MapDocument;
  layer: LayerId;
  children?: ReactNode;
}) {
  const { nodes, paths } = layerCounts(doc, layer);
  return (
    <section
      aria-label={t("This map")}
      className="card flex flex-col gap-2.5 text-sm"
    >
      <h3 className="label">{t("This map")}</h3>
      <p>
        <span className="text-gold">{t(LAYER_NAMES[layer])}</span>
        <span className="text-muted">
          {" · "}
          {t("{nodes} nodes and {edges} paths", {
            nodes,
            edges: paths,
          })}
        </span>
      </p>
      {children}
    </section>
  );
}
