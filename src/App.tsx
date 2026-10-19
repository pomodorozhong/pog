import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  STEP_SIZES,
  type LayerId,
  type Language,
  type MapView,
  type MapNode,
  type PlayerDocument,
  type Point,
  type StepSize,
} from "./domain/types";
import { translate, type Translate } from "./i18n/translation";
import { loadGameData, type GameData } from "./map/catalog";
import { AutoImport, AutoImportSwitch } from "./progress/AutoImport";
import {
  historyReducer,
  newId,
  type History,
  type HistoryAction,
  type MapAction,
} from "./map/editing";
import { drawTo, dropJunction, type Draft } from "./map/drawing";
import { gameGraceNodes, withGameGraces } from "./map/graces";
import { Inspector } from "./map/Inspector";
import { MapCanvas, type Selection } from "./map/MapCanvas";
import { MapDetails } from "./map/MapDetails";
import {
  ImportFromProfile,
  DeletePlaythrough,
  ImportFromAnother,
  ProfilePanel,
  ProfileSummary,
} from "./profiles/ProfilePanel";
import {
  ChevronIcon,
  MenuIcon,
  RedoIcon,
  ToolIcon,
  UndoIcon,
} from "./layout/icons";
import { useDismiss } from "./layout/useDismiss";
import { COMPACT, NARROW, useMediaQuery } from "./layout/useMediaQuery";
import { LayerButton } from "./map/LayerButton";
import { WalkList } from "./wishlist/WalkList";
import {
  combinedWishlist,
  countByStatus,
  walkedBosses,
} from "./wishlist/wishlist";
import { unfinishedPins } from "./map/pathArrows";
import { NodeProgress, ProgressPanel } from "./progress/ProgressPanel";
import { beatenBosses, undiscoveredGraces } from "./progress/progress";
import { activeProfile, addProfile, TEMPLATES } from "./profiles/profiles";
import { displayName } from "./map/catalog";
import { detour, routeLines } from "./routing/order";
import { RoutePanel } from "./routing/RoutePanel";
import { usePlannedRoute } from "./routing/usePlannedRoute";
import { initialDocuments, mapKey } from "./storage/schema";
import {
  PinWishlist,
  UnpinnedPicker,
  WishlistPanel,
} from "./wishlist/WishlistPanel";
import {
  usePersistentDocument,
  type SaveStatus,
} from "./storage/usePersistentDocument";

export type Tool = "select" | "pin" | "path";
const STEP_SIZE_NAMES: Record<StepSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const TOOLS: { tool: Tool; label: string; key: string; tip: string }[] = [
  {
    tool: "select",
    label: "Select",
    key: "v",
    tip: "Select, move and edit nodes and paths",
  },
  {
    tool: "pin",
    label: "Pin",
    key: "n",
    tip: "Place a pin: a junction, an entrance or where items are, set in its details",
  },
  {
    tool: "path",
    label: "Draw path",
    key: "p",
    tip: "Draw a path through pins: each click on the map drops a junction",
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
  const [selection, setSelection] = useState<Selection>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** Choosing "New playthrough…" in the switcher. */
  const [creating, setCreating] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  // A narrow window shows the route; editing is one tab of its bottom sheet.
  const narrow = useMediaQuery(NARROW);
  const [sheet, setSheet] = useState<"route" | "edit">("route");
  const [sheetTall, setSheetTall] = useState(false);
  const editing = !narrow || sheet === "edit";
  // Below this width the tools show as icons with their keys.
  const compact = useMediaQuery(COMPACT);
  /** Select something and show its details in the panel. */
  const selectAndEdit = useCallback((next: Selection) => {
    setSelection(next);
    if (next) setSheet("edit");
  }, []);
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
  const changeHistory = useCallback((type: "undo" | "redo") => {
    setDraft(null);
    dispatch({ type });
  }, []);

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
  const routeNodes = useMemo(
    () =>
      new Set(
        plan?.route.legs.flatMap((leg) =>
          leg.flatMap((step) => [step.from, step.to]),
        ),
      ),
    [plan],
  );
  const undiscovered = useMemo(
    () =>
      data && progress
        ? undiscoveredGraces(data, map.nodes, progress)
        : new Set<string>(),
    [data, map.nodes, progress],
  );

  const beaten = useMemo(
    () => (data ? beatenBosses(data, progress) : new Set<string>()),
    [data, progress],
  );
  const unfinished = useMemo(
    () =>
      unfinishedPins(
        map.nodes,
        undiscovered,
        beaten,
        profile ? combinedWishlist(map, profile.wishlist).pinned : [],
      ),
    [map, undiscovered, beaten, profile],
  );

  const nodeById = useMemo(
    () => new Map(map.nodes.map((n) => [n.id, n])),
    [map.nodes],
  );

  // A new pin is a junction; its details make it an entrance or give it items.
  const addPin = useCallback(
    ([x, y]: Point) => {
      const node: MapNode = {
        id: newId("junction"),
        layer,
        x,
        y,
        kind: "junction",
        label: "",
        ref: null,
      };
      edit({ type: "addNode", node });
      return node.id;
    },
    [edit, layer],
  );

  const activeTool: Tool = editing ? tool : "select";
  const handlers = {
    onMapClick(point: Point) {
      if (activeTool === "select") return setSelection(null);
      if (activeTool === "path") {
        const from = draft ? nodeById.get(draft.from) : undefined;
        const next = dropJunction(draft, from, layer, point);
        edit(next.action);
        return setDraft(next.draft);
      }
      selectAndEdit({ kind: "node", id: addPin(point) });
    },
    onNodeClick(id: string) {
      if (activeTool === "path") {
        const to = nodeById.get(id);
        if (!to) return;
        const from = draft ? nodeById.get(draft.from) : undefined;
        const next = drawTo(draft, from, to);
        if (next.action) edit(next.action);
        return setDraft(next.draft);
      }
      selectAndEdit({ kind: "node", id });
    },
    onNodeMove(id: string, [x, y]: Point) {
      edit({ type: "updateNode", id, changes: { x, y } });
    },
    onEdgeClick(id: string) {
      if (activeTool !== "path") selectAndEdit({ kind: "edge", id });
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
      selectAndEdit({ kind: "node", id });
    },
    [nodeById, player, layer, selectAndEdit],
  );

  /** Where visiting a node fits best in the planned route, in words. */
  const detourText = (node: string) => {
    if (!plan) return t("Set your position to see where this fits the route.");
    const best = detour(plan.times, plan.start, plan.route.order, node);
    if (!best) return t("The route can't reach this pin.");
    const after = best.after && nodeById.get(best.after);
    return after
      ? t("Best visited after {stop}.", {
          stop: displayName(data, after, language) || t("a junction"),
        })
      : t("Best visited as the first stop.");
  };

  /** Go on drawing a path from its last pin. */
  const extendPath = useCallback(
    (id: string) => {
      const edge = doc.edges.find((e) => e.id === id);
      if (!edge) return;
      const last = edge.nodes[edge.nodes.length - 1];
      showNode(last);
      setSelection(null);
      setTool("path");
      setDraft({ from: last, edge: id });
    },
    [doc.edges, showNode],
  );

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
        changeHistory(event.shiftKey ? "redo" : "undo");
        return;
      }
      if (mod || event.altKey) return;
      // End the path being drawn; every pin dropped so far stays on the map.
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
  }, [draft, deleteSelection, changeHistory]);

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

  const languageSelect = (
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
  );
  const stepSizeSelect = (
    <select
      aria-label={t("Path numbers")}
      className="field"
      value={player.stepSize}
      onChange={(event) =>
        setPlayer({ ...player, stepSize: event.target.value as StepSize })
      }
    >
      {STEP_SIZES.map((size) => (
        <option key={size} value={size}>
          {t(STEP_SIZE_NAMES[size])}
        </option>
      ))}
    </select>
  );

  // The tracker shows entries at a pin; the others wait in the wishlist card.
  const wishlist = combinedWishlist(map, activeProfile(player).wishlist).pinned;
  const wishlistCounts = countByStatus(wishlist);
  const routeBosses = walkedBosses(map);

  const inspector = (
    <Inspector
      t={t}
      language={language}
      data={data}
      doc={map}
      selection={selection}
      layer={layer}
      edit={edit}
      select={selectAndEdit}
      showNode={showNode}
      highlight={setHighlight}
      extendPath={extendPath}
      deleteSelection={deleteSelection}
      recovery={mapSave.recovery ?? playerSave.recovery}
      beaten={beaten}
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
        </>
      }
      mapActions={
        <ImportFromAnother
          t={t}
          player={player}
          importer={
            <ImportFromProfile
              key={player.activeProfile}
              t={t}
              player={player}
              doc={map}
              readMap={readMap}
              edit={edit}
            />
          }
        />
      }
      profileActions={
        <DeletePlaythrough t={t} player={player} setPlayer={setPlayer} />
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
        </>
      )}
      itemControls={(node, item) => (
        <PinWishlist
          t={t}
          player={player}
          setPlayer={setPlayer}
          doc={map}
          pin={node.id}
          item={item}
          estimate={detourText(node.id)}
        />
      )}
      unpinnedItems={(node, addItem) => (
        <UnpinnedPicker
          t={t}
          language={language}
          data={data}
          player={player}
          setPlayer={setPlayer}
          doc={map}
          node={node}
          addItem={addItem}
        />
      )}
    />
  );

  const mapTools = TOOLS.map(({ tool: id, label, key, tip }) => (
    <button
      key={id}
      className={
        narrow
          ? "chip relative grid h-9 w-10 place-items-center px-0"
          : "map-pill"
      }
      aria-pressed={tool === id}
      aria-label={compact ? t(label) : undefined}
      title={`${t(label)}: ${t(tip)} (${key.toUpperCase()})`}
      onClick={() => {
        setTool(id);
        setDraft(null);
      }}
    >
      <ToolIcon tool={id} />
      {!compact && t(label)}{" "}
      <kbd
        className={
          narrow
            ? "absolute right-1 bottom-0 font-sans text-[9px] text-muted"
            : "font-sans text-[11px] text-muted"
        }
      >
        {key.toUpperCase()}
      </kbd>
    </button>
  ));
  const historyButtons = (
    <>
      <button
        className="icon-button"
        aria-label={t("Undo")}
        title={`${t("Undo")} (⌘Z)`}
        disabled={!history.past.length}
        onClick={() => changeHistory("undo")}
      >
        <UndoIcon />
      </button>
      <button
        className="icon-button"
        aria-label={t("Redo")}
        title={`${t("Redo")} (⇧⌘Z)`}
        disabled={!history.future.length}
        onClick={() => changeHistory("redo")}
      >
        <RedoIcon />
      </button>
    </>
  );
  // The route list, or what's being edited: the bottom sheet of a narrow
  // window, the side column of a wider one.
  const panel = (
    <section
      aria-label={t("Route and editing")}
      className={
        narrow
          ? `flex shrink-0 flex-col border-t border-line bg-panel ${sheetTall ? "h-[75%]" : "max-h-[40%]"}`
          : "flex min-h-0 w-96 shrink-0 flex-col border-l border-line bg-panel"
      }
    >
      <div className="flex items-center gap-1 py-1 pr-2 pl-4">
        <h2 className="label flex min-w-0 flex-1 items-baseline gap-2">
          {sheet === "route" ? (
            <>
              {t("Playthrough tracker")}
              <span className="tracking-normal normal-case">
                {t("{acquired} of {total} items acquired", {
                  acquired: wishlistCounts.acquired,
                  total: wishlist.length,
                })}
                {/* The boss count shows once the walk reaches a boss. */}
                {routeBosses.length > 0 &&
                  ` · ${t("{beaten} of {bosses} bosses beaten", {
                    beaten: routeBosses.filter((b) => beaten.has(b)).length,
                    bosses: routeBosses.length,
                  })}`}
              </span>
            </>
          ) : (
            t("Edit")
          )}
        </h2>
        {/* Words, not a pencil: what it does, and how to get back. */}
        <button
          className="chip shrink-0 text-xs"
          aria-pressed={sheet === "edit"}
          onClick={() => {
            setSheet(sheet === "edit" ? "route" : "edit");
            setDraft(null);
          }}
        >
          {sheet === "edit" ? t("Done") : t("Edit")}
        </button>
        {narrow && (
          <button
            className="grid size-9 place-items-center rounded-lg text-muted hover:text-gold"
            aria-label={t(sheetTall ? "Shrink panel" : "Expand panel")}
            onClick={() => setSheetTall(!sheetTall)}
          >
            <ChevronIcon up={!sheetTall} />
          </button>
        )}
      </div>
      {sheet === "route" ? (
        <WalkList
          key={player.activeProfile}
          t={t}
          language={language}
          data={data}
          player={player}
          setPlayer={setPlayer}
          doc={map}
          showNode={showNode}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col [&>aside]:max-h-none [&>aside]:min-h-0 [&>aside]:flex-1">
          {inspector}
        </div>
      )}
    </section>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="relative z-[1100] border-b border-line bg-panel">
        <ProfileSummary
          t={t}
          player={player}
          setPlayer={setPlayer}
          onNewPlaythrough={() => setCreating(true)}
          actions={
            <>
              <span className="ml-auto text-xs has-[span:empty]:hidden">
                <SaveIndicator
                  t={t}
                  statuses={[mapSave.status, playerSave.status]}
                  quiet
                />
              </span>
              {!narrow && historyButtons}
              <AppMenu t={t}>
                <AutoImportSwitch t={t} player={player} setPlayer={setPlayer} />
                <label className="flex flex-col gap-1">
                  <span className="label">{t("Path numbers")}</span>
                  {stepSizeSelect}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="label">{t("Language")}</span>
                  {languageSelect}
                </label>
              </AppMenu>
            </>
          }
        />
        {creating && (
          <NewPlaythrough
            t={t}
            close={() => setCreating(false)}
            create={(template) => {
              setPlayer(addProfile(player, template));
              setSheet("edit");
              setSelection(null);
              setCreating(false);
            }}
          />
        )}
      </header>
      {narrow && editing && (
        <div
          className="flex flex-wrap items-center gap-1 border-b border-line bg-panel/70 px-3 py-1.5 text-sm"
          role="toolbar"
          aria-label={t("Map tools")}
        >
          {mapTools}
          <button
            className="chip ml-1 grid size-8 place-items-center px-0"
            aria-label={t("Tool hint")}
            aria-pressed={hintOpen}
            onClick={() => setHintOpen(!hintOpen)}
          >
            ?
          </button>
          <div className="ml-auto flex gap-1">{historyButtons}</div>
        </div>
      )}

      <div className={`flex min-h-0 flex-1 ${narrow ? "flex-col" : ""}`}>
        <div
          className={`relative flex-1 tool-${activeTool} steps-${player.stepSize} map-area min-h-0`}
        >
          <MapCanvas
            {...handlers}
            layer={layer}
            info={data.layers[layer]}
            view={player.view}
            nodes={map.nodes}
            edges={map.edges}
            selection={selection}
            draft={draft}
            editable={editing && tool === "select"}
            drawing={activeTool === "path"}
            hideUnusedGraces={player.hideUnusedGraces}
            graceNames={player.graceNames}
            language={language}
            data={data}
            undiscovered={undiscovered}
            unfinished={unfinished}
            position={progress?.position ?? null}
            beaten={beaten}
            route={route}
            stops={stops}
            routeNodes={routeNodes}
            highlight={highlight}
          />
          {!narrow && (
            <div
              role="toolbar"
              aria-label={t("Map tools")}
              className="absolute top-2.5 left-14 z-[800] flex gap-1.5"
            >
              {mapTools}
            </div>
          )}
          <MapDetails
            t={t}
            settings={player}
            onChange={(changes) => setPlayer({ ...player, ...changes })}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          />
          <LayerButton t={t} layer={layer} onChange={switchLayer} />
          {editing && (
            <p
              className={`pointer-events-none absolute z-[500] max-w-[60%] rounded bg-ink/85 px-2 py-1 text-xs text-muted ${narrow ? "top-2 left-2" : "right-2 bottom-2"} ${narrow && !hintOpen ? "hidden" : ""}`}
            >
              {t(toolHint(tool, draft !== null))}
            </p>
          )}
        </div>
        {panel}
      </div>
      <AutoImport
        t={t}
        language={language}
        data={data}
        player={player}
        setPlayer={setPlayer}
        doc={map}
      />
    </div>
  );
}

/** The menu at the top right: display settings. */
function AppMenu({ t, children }: { t: Translate; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(container, open, close);
  return (
    <div ref={container} className="relative">
      <button
        className="icon-button"
        aria-label={t("Menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="popover absolute top-full right-0 mt-1 flex w-64 flex-col gap-3 p-3.5 text-sm">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Start a playthrough, empty or from a template, chosen from the playthrough
 * switcher. It opens under the switcher.
 */
function NewPlaythrough({
  t,
  close,
  create,
}: {
  t: Translate;
  close(): void;
  create(template?: (typeof TEMPLATES)[number]): void;
}) {
  const [template, setTemplate] = useState("");
  const container = useRef<HTMLElement>(null);
  useDismiss(container, true, close);
  return (
    <section
      ref={container}
      aria-label={t("New playthrough")}
      className="popover absolute top-full left-3 z-[950] mt-1 flex w-72 flex-col gap-2 p-3.5 text-sm"
    >
      <label className="flex flex-col gap-1">
        <span className="label">{t("Start from")}</span>
        <select
          className="field"
          autoFocus
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="">{t("An empty playthrough")}</option>
          {TEMPLATES.map((p) => (
            <option key={p.name} value={p.name}>
              {t("“{name}”, with its wishlist of {count} items", {
                name: p.name,
                count: p.wishlist.length,
              })}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          className="chip"
          aria-pressed="true"
          onClick={() => create(TEMPLATES.find((p) => p.name === template))}
        >
          {t("Create")}
        </button>
        <button className="chip" onClick={close}>
          {t("Cancel")}
        </button>
      </div>
    </section>
  );
}

function toolHint(tool: Tool, drawing: boolean) {
  if (tool === "path")
    return drawing
      ? "Click the map to drop a junction on the path, or click a node to take the path through it. Esc ends the path."
      : "Click a node (or the map) to start a path.";
  if (tool === "select")
    return "Click to select, drag to move. Delete removes the selection; ⌘Z undoes.";
  return "Click the map to place a pin. Click an existing node to select it.";
}

function SaveIndicator({
  t,
  statuses,
  quiet = false,
}: {
  t: Translate;
  statuses: SaveStatus[];
  /** Say nothing while everything is saved. */
  quiet?: boolean;
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
      {quiet && (!worst || worst === "saving")
        ? null
        : t(worst ? text[worst] : "Saved to this computer")}
    </span>
  );
}
