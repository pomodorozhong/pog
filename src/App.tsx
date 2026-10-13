import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  EDGE_TYPES,
  LAYERS,
  type EdgeType,
  type LayerId,
  type Language,
  type MapView,
  type NodeKind,
  type PlayerDocument,
  type Point,
} from "./domain/types";
import { translate, type Translate } from "./i18n/translation";
import { loadGameData, type GameData } from "./map/catalog";
import {
  historyReducer,
  newId,
  type History,
  type HistoryAction,
  type MapAction,
} from "./map/editing";
import { dropJunction, pathAction } from "./map/drawing";
import { gameGraceNodes, withGameGraces } from "./map/graces";
import { Inspector } from "./map/Inspector";
import { EDGE_NAMES, LAYER_NAMES } from "./map/labels";
import { MapCanvas, type Draft, type Selection } from "./map/MapCanvas";
import { EDGE_STYLE } from "./map/style";
import {
  ImportFromProfile,
  ProfilePanel,
  ProfileSwitcher,
} from "./profiles/ProfilePanel";
import { NodeProgress, ProgressPanel } from "./progress/ProgressPanel";
import { undiscoveredGraces } from "./progress/progress";
import { activeProfile } from "./profiles/profiles";
import { displayName } from "./map/catalog";
import { detour, routeLines } from "./routing/order";
import { RoutePanel } from "./routing/RoutePanel";
import { formatDuration } from "./routing/format";
import { usePlannedRoute } from "./routing/usePlannedRoute";
import { initialDocuments, mapKey } from "./storage/schema";
import { PinWishlist, WishlistPanel } from "./wishlist/WishlistPanel";
import {
  usePersistentDocument,
  type SaveStatus,
} from "./storage/usePersistentDocument";

export type Tool = "select" | NodeKind | "path";
const TOOLS: { tool: Tool; label: string; key: string; tip: string }[] = [
  {
    tool: "select",
    label: "Select",
    key: "v",
    tip: "Select, move and edit nodes and paths",
  },
  {
    tool: "junction",
    label: "Junction",
    key: "j",
    tip: "An unnamed point where paths meet or turn",
  },
  {
    tool: "item",
    label: "Item pin",
    key: "i",
    tip: "Where an item is picked up, linked to the item",
  },
  {
    tool: "entrance",
    label: "Entrance",
    key: "e",
    tip: "A dungeon entrance, linked to a game place",
  },
  {
    tool: "path",
    label: "Draw path",
    key: "p",
    tip: "Each click drops a junction and draws a path to it",
  },
];

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [dataError, setDataError] = useState(false);
  // Game graces show on every profile's map without being stored in it.
  const graces = useMemo(
    () => (data ? gameGraceNodes(data.catalog.graces) : []),
    [data],
  );
  const fixedNodes = useMemo(
    () => new Map(graces.map((n) => [n.id, n])),
    [graces],
  );
  const reducer = useCallback(
    (history: History, action: HistoryAction) =>
      historyReducer(history, action, fixedNodes),
    [fixedNodes],
  );
  const [history, dispatch] = useReducer(reducer, {
    past: [],
    present: initialDocuments().map,
    future: [],
  });
  const [player, setPlayer] = useState<PlayerDocument | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [edgeType, setEdgeType] = useState<EdgeType>("road");
  const [selection, setSelection] = useState<Selection>(null);
  const [draft, setDraft] = useState<Draft>(null);
  /** The profile whose map is in `history`. */
  const [mapProfile, setMapProfile] = useState<string | null>(null);
  const views = useRef(new Map<LayerId, MapView>());
  // Undo history of each profile's map, kept while switching between them.
  const histories = useRef(new Map<string, History>());
  const latestHistory = useRef(history);
  useEffect(() => {
    latestHistory.current = history;
  }, [history]);

  /** The profile's own nodes and paths, as saved. */
  const doc = history.present;
  /** What the map shows and routes over: the profile's map plus game graces. */
  const map = useMemo(() => withGameGraces(doc, graces), [doc, graces]);
  const activeProfileId = player?.activeProfile ?? null;
  const mapLoaded = mapProfile !== null && mapProfile === activeProfileId;
  const mapSave = usePersistentDocument(
    "map",
    activeProfileId === null ? null : mapKey(activeProfileId),
    mapLoaded ? doc : null,
    (loaded, key) => {
      if (mapProfile) histories.current.set(mapProfile, latestHistory.current);
      const profile = key.slice("maps/".length);
      const kept = histories.current.get(profile);
      // Keep undo history only if the map wasn't changed elsewhere meanwhile.
      const history =
        kept && JSON.stringify(kept.present) === JSON.stringify(loaded)
          ? { ...kept, present: loaded }
          : undefined;
      dispatch({ type: "load", doc: loaded, history });
      setSelection(null);
      setDraft(null);
      setMapProfile(profile);
    },
  );
  const readSavedMap = mapSave.read;
  const readMap = useCallback(
    async (profile: string) => {
      const map = await readSavedMap(mapKey(profile));
      return map.canSave ? map.state : null;
    },
    [readSavedMap],
  );
  const playerSave = usePersistentDocument(
    "player",
    "player",
    player,
    (loaded) => {
      views.current.set(loaded.view.layer, loaded.view);
      setPlayer(loaded);
    },
  );

  useEffect(() => {
    loadGameData().then(setData, () => setDataError(true));
  }, []);

  const language: Language = player?.language ?? "en";
  const t: Translate = useCallback(
    (key, values) => translate(language, key, values),
    [language],
  );
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const layer = player?.view.layer ?? "overworld";
  const edit = useCallback((action: MapAction) => dispatch(action), []);

  const profile = player ? activeProfile(player) : null;
  const progress = profile?.progress ?? null;
  const plan = usePlannedRoute(data, map, profile);
  const route = useMemo(
    () => (plan ? routeLines(map, plan.route.legs) : []),
    [map, plan],
  );
  const stops = useMemo(
    () => new Map(plan?.route.order.map((id, i) => [id, i + 1])),
    [plan],
  );
  const undiscovered = useMemo(
    () =>
      data && progress
        ? undiscoveredGraces(data, map.nodes, progress)
        : new Set<string>(),
    [data, map.nodes, progress],
  );

  const nodeById = useMemo(
    () => new Map(map.nodes.map((n) => [n.id, n])),
    [map.nodes],
  );

  const finishPath = useCallback(
    (to: string) => {
      if (!draft || to === draft.from) return;
      // Only waygates join layers; any other path must end on the layer it started on.
      if (
        nodeById.get(draft.from)?.layer !== nodeById.get(to)?.layer &&
        edgeType !== "waygate"
      )
        return;
      edit(pathAction(draft.from, to, edgeType));
      // Keep drawing from the node just reached, so a route can be laid down in one go.
      setDraft({ from: to });
    },
    [draft, edgeType, edit, nodeById],
  );

  const addNode = useCallback(
    (kind: NodeKind, [x, y]: Point) => {
      const node = { id: newId(kind), layer, x, y, kind, label: "", ref: null };
      edit({ type: "addNode", node });
      return node.id;
    },
    [edit, layer],
  );

  const handlers = {
    onMapClick(point: Point) {
      if (tool === "select") return setSelection(null);
      if (tool === "path") {
        const from = draft ? nodeById.get(draft.from) : undefined;
        const { action, next } = dropJunction(from, layer, point, edgeType);
        edit(action);
        return setDraft({ from: next });
      }
      setSelection({ kind: "node", id: addNode(tool, point) });
    },
    onNodeClick(id: string) {
      if (tool === "path")
        return draft ? finishPath(id) : setDraft({ from: id });
      setSelection({ kind: "node", id });
    },
    onNodeMove(id: string, [x, y]: Point) {
      edit({ type: "updateNode", id, changes: { x, y } });
    },
    onEdgeClick(id: string) {
      if (tool !== "path") setSelection({ kind: "edge", id });
    },
    onViewChange(view: MapView) {
      views.current.set(view.layer, view);
      setPlayer((p) => (p && p.view.layer === view.layer ? { ...p, view } : p));
    },
  };

  const switchLayer = useCallback(
    (next: LayerId) => {
      if (!player || !data || next === player.view.layer) return;
      const size = data.layers[next].size;
      const view = views.current.get(next) ?? {
        layer: next,
        x: size / 2,
        y: size / 2,
        zoom: 3,
      };
      setPlayer({ ...player, view });
    },
    [player, data],
  );

  const showNode = useCallback(
    (id: string) => {
      const node = nodeById.get(id);
      if (!node || !player) return;
      if (node.layer !== layer) {
        const zoom = views.current.get(node.layer)?.zoom ?? 4;
        views.current.set(node.layer, {
          layer: node.layer,
          x: node.x,
          y: node.y,
          zoom,
        });
        setPlayer({
          ...player,
          view: { layer: node.layer, x: node.x, y: node.y, zoom },
        });
      }
      setSelection({ kind: "node", id });
    },
    [nodeById, player, layer],
  );

  /** What visiting a node would add to the planned route, in words. */
  const detourText = (node: string) => {
    if (!plan) return t("Set your position to estimate the detour.");
    const cost = detour(plan.times, plan.start, plan.route.order, node);
    if (!cost) return t("The route can't reach this pin.");
    const after = cost.after && nodeById.get(cost.after);
    return after
      ? t("Adds {time} to the route, best after {stop}.", {
          time: formatDuration(t, cost.seconds),
          stop: displayName(data, after, language) || t("a junction"),
        })
      : t("Adds {time} to the route, best as the first stop.", {
          time: formatDuration(t, cost.seconds),
        });
  };

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    edit(
      selection.kind === "node"
        ? { type: "removeNode", id: selection.id }
        : { type: "removeEdge", id: selection.id },
    );
    setSelection(null);
  }, [selection, edit]);

  // Keyboard shortcuts, ignored while typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setDraft(null);
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod || event.altKey) return;
      // Stop drawing; every junction dropped so far stays on the map.
      if (event.key === "Escape")
        return draft ? setDraft(null) : setSelection(null);
      if (event.key === "Delete" || event.key === "Backspace")
        return deleteSelection();
      const picked = TOOLS.find(
        (entry) => entry.key === event.key.toLowerCase(),
      );
      if (picked) {
        setTool(picked.tool);
        setDraft(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, deleteSelection]);

  if (dataError)
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="font-serif text-xl text-gold">
            {t("Game data is missing")}
          </h1>
          <p className="text-muted">
            {t("Run the extractor first, then reload this page:")}
          </p>
          <code className="block rounded border border-line bg-panel p-2 text-sm">
            npm run extract
          </code>
        </div>
      </main>
    );
  if (!data || !player || !mapLoaded)
    return (
      <main className="grid h-full place-items-center text-muted">
        {t("Loading…")}
      </main>
    );

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-3 py-2">
        <h1 className="font-serif text-lg text-gold">{t("Route of Grace")}</h1>
        <nav className="flex flex-wrap gap-1" aria-label={t("Map layer")}>
          {LAYERS.map((id) => (
            <button
              key={id}
              className="chip"
              aria-pressed={id === layer}
              onClick={() => switchLayer(id)}
            >
              {t(LAYER_NAMES[id])}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <SaveIndicator t={t} statuses={[mapSave.status, playerSave.status]} />
          <ProfileSwitcher t={t} player={player} setPlayer={setPlayer} />
          <select
            aria-label={t("Language")}
            className="field"
            value={language}
            onChange={(event) =>
              setPlayer({ ...player, language: event.target.value as Language })
            }
          >
            <option value="en">English</option>
            <option value="zh-TW">繁體中文</option>
          </select>
        </div>
      </header>

      <div
        className="flex flex-wrap items-center gap-1 border-b border-line bg-panel/70 px-3 py-1.5 text-sm"
        role="toolbar"
        aria-label={t("Map tools")}
      >
        {TOOLS.map(({ tool: id, label, key, tip }) => (
          <button
            key={id}
            className="chip"
            aria-pressed={tool === id}
            title={`${t(tip)} (${key.toUpperCase()})`}
            onClick={() => {
              setTool(id);
              setDraft(null);
            }}
          >
            {t(label)} <kbd>{key.toUpperCase()}</kbd>
          </button>
        ))}
        {tool === "path" && (
          <label className="ml-2 flex items-center gap-2">
            <span className="text-muted">{t("Path type")}</span>
            <select
              className="field"
              value={edgeType}
              onChange={(event) => setEdgeType(event.target.value as EdgeType)}
            >
              {EDGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(EDGE_NAMES[type])}
                </option>
              ))}
            </select>
            <span
              className="swatch"
              style={{ background: EDGE_STYLE[edgeType].color }}
            />
          </label>
        )}
        <div className="ml-auto flex gap-1">
          <button
            className="chip"
            disabled={!history.past.length}
            onClick={() => dispatch({ type: "undo" })}
          >
            {t("Undo")}
          </button>
          <button
            className="chip"
            disabled={!history.future.length}
            onClick={() => dispatch({ type: "redo" })}
          >
            {t("Redo")}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className={`relative min-h-[50vh] flex-1 tool-${tool}`}>
          <MapCanvas
            {...handlers}
            layer={layer}
            info={data.layers[layer]}
            view={player.view}
            nodes={map.nodes}
            edges={map.edges}
            selection={selection}
            draft={draft}
            editable={tool === "select"}
            language={language}
            data={data}
            undiscovered={undiscovered}
            position={progress?.position ?? null}
            route={route}
            stops={stops}
          />
          <p className="pointer-events-none absolute bottom-2 left-2 z-[500] max-w-[70%] rounded bg-ink/85 px-2 py-1 text-xs text-muted">
            {t(toolHint(tool, draft !== null))}
          </p>
        </div>
        <Inspector
          t={t}
          language={language}
          data={data}
          doc={map}
          selection={selection}
          layer={layer}
          edit={edit}
          select={setSelection}
          showNode={showNode}
          deleteSelection={deleteSelection}
          recovery={mapSave.recovery ?? playerSave.recovery}
          profile={
            <>
              <ProfilePanel t={t} player={player} setPlayer={setPlayer} />
              <ProgressPanel
                t={t}
                language={language}
                data={data}
                player={player}
                setPlayer={setPlayer}
                doc={map}
                showNode={showNode}
              />
              <RoutePanel
                t={t}
                language={language}
                data={data}
                doc={map}
                plan={plan}
                showNode={showNode}
              />
              <WishlistPanel
                t={t}
                language={language}
                data={data}
                player={player}
                setPlayer={setPlayer}
                doc={map}
                showNode={showNode}
              />
              <ImportFromProfile
                key={player.activeProfile}
                t={t}
                player={player}
                doc={map}
                readMap={readMap}
                edit={edit}
              />
            </>
          }
          nodeControls={(node) => (
            <>
              <NodeProgress
                t={t}
                data={data}
                player={player}
                setPlayer={setPlayer}
                node={node}
              />
              {node.kind === "item" && node.ref && (
                <PinWishlist
                  t={t}
                  player={player}
                  setPlayer={setPlayer}
                  item={node.ref}
                  estimate={detourText(node.id)}
                />
              )}
            </>
          )}
        />
      </div>
    </div>
  );
}

function toolHint(tool: Tool, drawing: boolean) {
  if (tool === "path")
    return drawing
      ? "Click the map to drop a junction and keep drawing from it, or click a node to end the path there. Esc stops drawing."
      : "Click a node (or the map) to start a path.";
  if (tool === "select")
    return "Click to select, drag to move. Delete removes the selection; ⌘Z undoes.";
  return "Click the map to place. Click an existing node to select it.";
}

function SaveIndicator({
  t,
  statuses,
}: {
  t: Translate;
  statuses: SaveStatus[];
}) {
  const worst = (
    ["conflict", "memory", "failed", "saving", "loading"] as const
  ).find((s) => statuses.includes(s));
  const text: Record<string, string> = {
    conflict:
      "Saved data changed in another window. Reload before saving again.",
    memory: "Changes stay in memory",
    failed: "Changes cannot be saved to this computer",
    saving: "Saving…",
    loading: "Loading…",
  };
  return (
    <span
      role="status"
      className={worst && worst !== "saving" ? "text-danger" : "text-muted"}
    >
      {t(worst ? text[worst] : "Saved to this computer")}
    </span>
  );
}
