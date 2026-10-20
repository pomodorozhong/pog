import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  isWalked,
  pinItems,
  type GraceNameMode,
  type LayerId,
  type Language,
  type MapEdge,
  type MapNode,
  type MapView,
  type Point,
} from "../domain/types";
import {
  displayName,
  iconUrl,
  isItem,
  type GameData,
  type MapLayerInfo,
} from "./catalog";
import type { Draft } from "./drawing";
import { edgeRuns } from "./editing";
import { enableGestures } from "./gestures";
import { arrowsAlong, clipToBox, lineLength, currentPath } from "./pathArrows";
import { placeStep } from "./stepPlacement";
import { ARROW_SYMBOL, BOSS_SYMBOL, NODE_SYMBOL, pathStyle } from "./style";
import { isGameGrace } from "./graces";

export type Selection = { kind: "node" | "edge"; id: string } | null;

export type MapCanvasHandlers = {
  onMapClick(point: Point): void;
  onNodeClick(id: string): void;
  onNodeMove(id: string, point: Point): void;
  onEdgeClick(id: string): void;
  onViewChange(view: MapView): void;
};

type Props = MapCanvasHandlers & {
  layer: LayerId;
  info: MapLayerInfo;
  /** View to show when the layer is (re)opened. */
  view: MapView;
  nodes: MapNode[];
  edges: MapEdge[];
  selection: Selection;
  draft: Draft | null;
  editable: boolean;
  /** Draw path mode, including choosing the first pin. */
  drawing: boolean;
  hideUnusedGraces: boolean;
  graceNames: GraceNameMode;
  language: Language;
  data: GameData;
  /** Graces on the map not yet discovered in this playthrough. */
  undiscovered: Set<string>;
  /** Pins with something left to do, to tell which path the player is on. */
  unfinished: Set<string>;
  /** The node the player is at, or null. */
  position: string | null;
  /** Catalog ids of the bosses beaten in this playthrough. */
  beaten: Set<string>;
  /** A path to point out, for example while choosing where to move a path. */
  highlight: string | null;
};

const LABEL_ZOOM = 4;
const GRACE_LABEL_ZOOM = 6;
/** How far step numbers pinned to the screen edge stay from it, in pixels. */
const STEP_INSET = 24;
/** Screen pixels between direction arrows along a path. */
const ARROW_SPACING = 90;
/** How fast the next path's arrows move along it, in screen pixels a second. */
const ARROW_SPEED = 60;

export function MapCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.LayerGroup | null>(null);
  const rubberBand = useRef<L.Polyline | null>(null);
  const graceMarkers = useRef<
    { id: string; marker: L.Marker; onPath: boolean }[]
  >([]);
  const labels = useRef<
    { marker: L.Marker; always: boolean; minZoom: number | null }[]
  >([]);
  /** Step numbers on the map, with the stretches of their path on this layer. */
  const steps = useRef<{ marker: L.Marker; runs: Point[][] }[]>([]);
  /** Paths' stretches on this layer, to place direction arrows along. */
  const arrows = useRef<{ runs: Point[][]; color: string; moving: boolean }[]>(
    [],
  );
  const arrowLayer = useRef<L.LayerGroup | null>(null);
  /** The current path's moving arrows, placed again on every zoom frame. */
  const movingLayer = useRef<L.LayerGroup | null>(null);
  // Leaflet handlers are bound once; they read the latest props through this ref.
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const syncGraceVisibility = () => {
    const group = overlay.current;
    if (!group) return;
    const { hideUnusedGraces, drawing, position, selection } = latest.current;
    for (const { id, marker, onPath } of graceMarkers.current) {
      const visible =
        !hideUnusedGraces ||
        drawing ||
        onPath ||
        position === id ||
        (selection?.kind === "node" && selection.id === id);
      // Keep retained markers and the rest of the overlay attached. Rebuilding
      // everything here restarts tooltip fades and makes the map flash.
      if (visible && !group.hasLayer(marker)) marker.addTo(group);
      else if (!visible && group.hasLayer(marker)) group.removeLayer(marker);
    }
  };
  useLayoutEffect(syncGraceVisibility, [props.hideUnusedGraces, props.drawing]);

  const toLatLng = ([x, y]: Point) =>
    map.current!.unproject([x, y], latest.current.info.maxZoom);
  const placeAllSteps = () =>
    map.current &&
    placeSteps(map.current, steps.current, latest.current.info.maxZoom);
  const updateLabels = () => {
    const zoom = map.current!.getZoom();
    for (const { marker, always, minZoom } of labels.current) {
      const tooltip = marker.getTooltip()!;
      const permanent = always || (minZoom !== null && zoom >= minZoom);
      if (tooltip.options.permanent !== permanent)
        marker.unbindTooltip().bindTooltip(tooltip.getContent()!, {
          ...tooltip.options,
          permanent,
        });
    }
  };
  const toPoint = (latLng: L.LatLng): Point => {
    const p = map.current!.project(latLng, latest.current.info.maxZoom);
    return [Math.round(p.x), Math.round(p.y)];
  };
  const placeAllArrows = (paused = false) =>
    map.current &&
    arrowLayer.current &&
    movingLayer.current &&
    placeArrows(
      map.current,
      paused ? null : arrowLayer.current,
      movingLayer.current,
      arrows.current,
      latest.current.info.maxZoom,
      paused,
    );

  // Create the map once.
  useEffect(() => {
    const instance = L.map(container.current!, {
      crs: L.CRS.Simple,
      minZoom: 1,
      maxZoom: 8,
      // Fractional zoom, so pinch and wheel zoom glide instead of stepping.
      zoomSnap: 0,
      zoomDelta: 0.5,
      scrollWheelZoom: false,
      attributionControl: false,
      doubleClickZoom: false,
      keyboard: false,
    });
    map.current = instance;
    overlay.current = L.layerGroup().addTo(instance);
    arrowLayer.current = L.layerGroup().addTo(instance);
    movingLayer.current = L.layerGroup().addTo(instance);
    rubberBand.current = L.polyline([], {
      color: "#eee9db",
      dashArray: "4 6",
      weight: 2,
      interactive: false,
    });
    instance.on("click", (event: L.LeafletMouseEvent) =>
      latest.current.onMapClick(toPoint(event.latlng)),
    );
    instance.on("mousemove", (event: L.LeafletMouseEvent) => {
      const { draft, nodes, layer } = latest.current;
      const from = draft && nodes.find((n) => n.id === draft.from);
      if (!from || from.layer !== layer) return;
      rubberBand.current!.setLatLngs([
        toLatLng([from.x, from.y]),
        event.latlng,
      ]);
    });
    const report = () => {
      const center = toPoint(instance.getCenter());
      latest.current.onViewChange({
        layer: latest.current.layer,
        x: center[0],
        y: center[1],
        zoom: instance.getZoom(),
      });
    };
    // Gestures move the map every frame; report the view once it settles.
    let reportTimer: ReturnType<typeof setTimeout> | undefined;
    instance.on("moveend zoomend", () => {
      clearTimeout(reportTimer);
      reportTimer = setTimeout(report, 150);
    });
    instance.on("move zoom resize", placeAllSteps);
    // Still arrows move with the map; they're spaced again once it settles.
    let paused = false;
    instance.on("moveend zoomend resize", () => {
      paused = false;
      placeAllArrows();
    });
    // Moving arrows follow lines in screen pixels, which a zoom doesn't
    // scale: they pause, still on the map, from a zoom's first frame (or
    // animation) until it ends.
    instance.on("zoom zoomanim", () => {
      if (paused) return;
      paused = true;
      placeAllArrows(true);
    });
    instance.on("zoomend", updateLabels);
    const disableGestures = enableGestures(instance);
    return () => {
      clearTimeout(reportTimer);
      disableGestures();
      instance.remove();
      map.current = null;
    };
  }, []);

  // Swap tiles when the layer changes.
  const { layer, info } = props;
  useEffect(() => {
    const instance = map.current!;
    const { view } = latest.current;
    const bounds = L.latLngBounds(
      toLatLng([0, info.size]),
      toLatLng([info.size, 0]),
    );
    const tiles = L.tileLayer(`/game-data/map/${layer}/{z}/{x}/{y}.jpg`, {
      tileSize: info.tileSize,
      maxNativeZoom: info.maxZoom,
      minNativeZoom: 0,
      noWrap: true,
      bounds,
    }).addTo(instance);
    instance.setMaxBounds(bounds.pad(0.25));
    instance.setView(toLatLng([view.x, view.y]), view.zoom, { animate: false });
    return () => {
      tiles.remove();
    };
  }, [layer, info]);

  // Redraw nodes, edges and the path being drawn.
  const {
    nodes,
    edges,
    selection,
    draft,
    editable,
    graceNames,
    language,
    data,
    undiscovered,
    unfinished,
    position,
    beaten,
    highlight,
  } = props;
  useEffect(() => {
    const group = overlay.current!;
    group.clearLayers();
    graceMarkers.current = [];
    steps.current = [];
    arrows.current = [];
    labels.current = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // A grace with a note is on its note path, so it shows like a pathed grace.
    const pathNodes = new Set(edges.flatMap((edge) => edge.nodes));
    const notes = new Map(
      edges.filter((e) => !isWalked(e)).map((e) => [e.nodes[0], e]),
    );
    const portalEnds = new Set<string>();
    // The path the player is on: its arrows move, the rest stay still.
    const current = currentPath(edges, position, unfinished);

    for (const edge of edges) {
      // Note paths are drawn as notes beside their pins, below.
      if (!isWalked(edge)) continue;
      // Pins a path jumps between layers at are marked instead of drawn.
      edge.nodes.forEach((id, i) => {
        const [a, b] = [byId.get(edge.nodes[i - 1]), byId.get(id)];
        if (a && b && a.layer !== b.layer) {
          portalEnds.add(a.id);
          portalEnds.add(b.id);
        }
      });
      const runs = edgeRuns(edge, byId, layer);
      arrows.current.push({
        runs,
        color: pathStyle(edge).color,
        moving: edge === current,
      });
      // A waygate may have only isolated endpoints on this layer. Its number
      // still belongs here, even though the jump itself has no drawn line.
      const stepRuns = runs.length
        ? runs
        : edge.nodes.flatMap((id): Point[][] => {
            const node = byId.get(id);
            return node?.layer === layer ? [[[node.x, node.y]]] : [];
          });
      if (!stepRuns.length) continue;
      const selected = selection?.kind === "edge" && selection.id === edge.id;
      const highlighted = highlight === edge.id;
      const style = pathStyle(edge);
      const select = (event: L.LeafletEvent) => {
        L.DomEvent.stop(event);
        latest.current.onEdgeClick(edge.id);
      };
      for (const points of runs) {
        const line = points.map(toLatLng);
        if (highlighted)
          L.polyline(line, {
            color: "#ffd84a",
            weight: style.weight + 10,
            opacity: 0.85,
            lineCap: "round",
            interactive: false,
          }).addTo(group);
        else if (selected)
          L.polyline(line, {
            color: "#fff",
            weight: style.weight + 6,
            opacity: 0.5,
            interactive: false,
          }).addTo(group);
        L.polyline(line, { ...style, opacity: 0.95 })
          .on("click", select)
          .addTo(group);
        if (edge.oneWay)
          addArrow(
            group,
            line[line.length - 2],
            line[line.length - 1],
            style.color,
          );
      }
      // One step number per path, placed by placeSteps. The note, when shown,
      // sits under it and moves with it.
      const note =
        edge.showNote && edge.note.trim()
          ? `<span class="step-note" style="border-color: ${style.color}">${escapeHtml(edge.note)}</span>`
          : "";
      const marker = L.marker(toLatLng(stepRuns[0][0]), {
        icon: L.divIcon({
          className: highlighted ? "path-step is-highlighted" : "path-step",
          html: `<span class="step-number">${edge.step}</span>${note}`,
          iconSize: [0, 0],
        }),
        keyboard: false,
        zIndexOffset: highlighted ? 1000 : 0,
      })
        .on("click", select)
        .addTo(group);
      steps.current.push({ marker, runs: stepRuns });
    }
    placeAllSteps();
    placeAllArrows();

    if (draft && byId.get(draft.from)?.layer === layer)
      rubberBand.current!.addTo(group);
    else rubberBand.current!.setLatLngs([]);

    for (const node of nodes) {
      if (node.layer !== layer) continue;
      const selected = selection?.kind === "node" && selection.id === node.id;
      const items = pinItems(node);
      const bosses = node.bosses ?? [];
      const itemNames = [...items, ...bosses].flatMap((id) => {
        const entry = data.byId.get(id);
        return entry ? [entry.name[language]] : [];
      });
      const grace = node.kind === "grace";
      const place = node.place ? data.byId.get(node.place) : undefined;
      // A grace keeps its own name; what the player added follows it.
      const official = node.ref ? data.byId.get(node.ref) : undefined;
      const name = grace
        ? [
            official?.name[language],
            node.label,
            place?.name[language],
            ...itemNames,
          ]
            .filter(Boolean)
            .join(" · ")
        : itemNames.length > 1
          ? [node.label, ...itemNames].filter(Boolean).join(" · ")
          : displayName(data, node, language);
      // A pin with items shows the first one's icon, and how many more it
      // holds. A grace stays a grace, with the icon as a badge.
      const first = items.length ? data.byId.get(items[0]) : undefined;
      const icon =
        first && isItem(first) && first.icon
          ? `<img src="${iconUrl(first.icon)}" alt="">`
          : items.length
            ? NODE_SYMBOL.item
            : "";
      const count =
        items.length > 1
          ? `<span class="item-count">+${items.length - 1}</span>`
          : "";
      // Bosses show as a skull: the pin's own symbol when it holds nothing
      // else, otherwise a badge, with how many when more than one.
      const bossOnly = bosses.length > 0 && !grace && !icon;
      const bossBadge =
        bosses.length > 0 && !bossOnly
          ? `<span class="boss-badge">${BOSS_SYMBOL}${bosses.length > 1 ? `<span class="boss-count">${bosses.length}</span>` : ""}</span>`
          : "";
      const image =
        (grace
          ? NODE_SYMBOL.grace +
            (icon && `<span class="grace-item">${icon}</span>`) +
            count
          : bossOnly
            ? BOSS_SYMBOL
            : (icon || NODE_SYMBOL[node.kind]) + count) + bossBadge;
      const classes = [
        "map-node",
        `map-node--${node.kind}`,
        items.length > 0 && !grace && "has-items",
        bossOnly && "has-bosses",
        bosses.length > 0 &&
          bosses.every((id) => beaten.has(id)) &&
          "bosses-beaten",
        selected && "is-selected",
        portalEnds.has(node.id) && "has-portal",
        draft?.from === node.id && "is-draft-start",
        undiscovered.has(node.id) && "is-undiscovered",
        position === node.id && "is-position",
      ];
      const marker = L.marker(toLatLng([node.x, node.y]), {
        icon: L.divIcon({
          className: classes.filter(Boolean).join(" "),
          html: image,
          iconSize: undefined,
        }),
        draggable: editable && !isGameGrace(node.id),
        keyboard: false,
        riseOnHover: true,
      })
        .on("click", (event) => {
          L.DomEvent.stop(event);
          latest.current.onNodeClick(node.id);
        })
        .on("dragend", (event) =>
          latest.current.onNodeMove(
            node.id,
            toPoint((event.target as L.Marker).getLatLng()),
          ),
        );
      // The pin's note, when shown, sits just below it.
      const note = notes.get(node.id);
      if (note?.showNote && note.note.trim())
        L.marker(toLatLng([node.x, node.y]), {
          icon: L.divIcon({
            className: "pin-note",
            html: `<span>${escapeHtml(note.note)}</span>`,
            iconSize: [0, 0],
          }),
          keyboard: false,
        })
          .on("click", (event) => {
            L.DomEvent.stop(event);
            latest.current.onNodeClick(node.id);
          })
          .addTo(group);
      if (node.kind === "grace")
        graceMarkers.current.push({
          id: node.id,
          marker,
          // What the player added to a grace keeps it shown, like a path.
          onPath:
            pathNodes.has(node.id) ||
            !!(node.label || node.place || items.length || bosses.length),
        });
      else marker.addTo(group);
      if (name) {
        const always = selected || position === node.id;
        const minZoom =
          node.kind === "grace"
            ? graceNames === "hover"
              ? null
              : graceNames === "always"
                ? 0
                : GRACE_LABEL_ZOOM
            : node.kind === "junction"
              ? null
              : LABEL_ZOOM;
        marker.bindTooltip(escapeHtml(name), {
          permanent:
            always || (minZoom !== null && map.current!.getZoom() >= minZoom),
          direction: "right",
          offset: [10, 0],
          className: `node-label node-label--${node.kind}`,
        });
        labels.current.push({ marker, always, minZoom });
      }
    }
    syncGraceVisibility();
  }, [
    nodes,
    edges,
    selection,
    draft,
    editable,
    graceNames,
    language,
    data,
    layer,
    undiscovered,
    unfinished,
    position,
    beaten,
    highlight,
  ]);

  // Pan to a node selected elsewhere (for example the far end of a waygate).
  useEffect(() => {
    if (selection?.kind !== "node") return;
    const node = nodes.find((n) => n.id === selection.id);
    const instance = map.current!;
    if (
      node?.layer === layer &&
      !instance.getBounds().contains(toLatLng([node.x, node.y]))
    )
      instance.panTo(toLatLng([node.x, node.y]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, layer]);

  return <div ref={container} className="map-canvas" data-testid="map" />;
}

function addArrow(
  group: L.LayerGroup,
  from: L.LatLng,
  to: L.LatLng,
  color: string,
) {
  const mid = L.latLng((from.lat + to.lat) / 2, (from.lng + to.lng) / 2);
  const angle =
    (Math.atan2(-(to.lat - from.lat), to.lng - from.lng) * 180) / Math.PI;
  L.marker(mid, {
    interactive: false,
    icon: L.divIcon({
      className: "edge-arrow",
      html: `<span style="color:${color};transform:rotate(${angle}deg)">➤</span>`,
      iconSize: [16, 16],
    }),
  }).addTo(group);
}

/**
 * Arrows along each path on screen, pointing the way it's walked. The
 * current path's arrows move along it, in its direction, unless motion is
 * reduced or they're `paused`.
 */
function placeArrows(
  instance: L.Map,
  /** Where still arrows go; null leaves them as they are. */
  layer: L.LayerGroup | null,
  /** Where the current path's arrows go. */
  movingLayer: L.LayerGroup,
  paths: { runs: Point[][]; color: string; moving: boolean }[],
  maxZoom: number,
  paused: boolean,
) {
  layer?.clearLayers();
  movingLayer.clearLayers();
  const { x: width, y: height } = instance.getSize();
  const box = { left: 0, top: 0, right: width, bottom: height };
  const still =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  for (const { runs, color, moving } of paths)
    for (const run of runs) {
      const onScreen = run.map((p): Point => {
        const { x, y } = instance.latLngToContainerPoint(
          instance.unproject(p, maxZoom),
        );
        return [x, y];
      });
      if (moving && !still && !paused) {
        addMovingArrows(instance, movingLayer, onScreen, color, {
          left: -ARROW_SPACING,
          top: -ARROW_SPACING,
          right: width + ARROW_SPACING,
          bottom: height + ARROW_SPACING,
        });
        continue;
      }
      const target = moving ? movingLayer : layer;
      if (!target) continue;
      arrowsAlong(onScreen, ARROW_SPACING, box).forEach(({ point, angle }) =>
        L.marker(instance.containerPointToLatLng(point), {
          interactive: false,
          keyboard: false,
          // Under pins, step numbers and their names.
          zIndexOffset: -1000,
          icon: L.divIcon({
            className: moving ? "path-arrow is-moving" : "path-arrow",
            html: `<span style="color:${color};transform:rotate(${angle}deg)">${ARROW_SYMBOL}</span>`,
            iconSize: [0, 0],
          }),
        }).addTo(target),
      );
    }
}

/**
 * Arrows that move along a line on screen, one every `ARROW_SPACING`
 * pixels, each following the line with CSS `offset-path`. Only the part near
 * the screen gets them, and their place along it follows the clock, so
 * placing them again as the map moves barely shifts them.
 */
function addMovingArrows(
  instance: L.Map,
  layer: L.LayerGroup,
  line: Point[],
  color: string,
  box: Parameters<typeof clipToBox>[1],
) {
  const now = performance.now() / 1000;
  const spans = clipToBox(line, box).flatMap((part) => {
    const length = lineLength(part);
    const count = Math.max(1, Math.round(length / ARROW_SPACING));
    const duration = length / ARROW_SPEED;
    const path = `M${part.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}`;
    return Array.from({ length: count }, (_, i) => {
      const delay = -((now + (i * duration) / count) % duration);
      return `<span style="color:${color};offset-path:path('${path}');animation-duration:${duration.toFixed(2)}s;animation-delay:${delay.toFixed(2)}s">${ARROW_SYMBOL}</span>`;
    });
  });
  if (!spans.length) return;
  // One marker at the screen's top-left corner holds them all.
  L.marker(instance.containerPointToLatLng([0, 0]), {
    interactive: false,
    keyboard: false,
    zIndexOffset: -1000,
    icon: L.divIcon({
      className: "path-arrow is-moving",
      html: spans.join(""),
      iconSize: [0, 0],
    }),
  }).addTo(layer);
}

/**
 * Keep each step number on the visible part of its path, or on the screen
 * edge nearest the path when all of it is off screen.
 */
function placeSteps(
  instance: L.Map,
  steps: { marker: L.Marker; runs: Point[][] }[],
  maxZoom: number,
) {
  const { x: width, y: height } = instance.getSize();
  const box = {
    left: STEP_INSET,
    top: STEP_INSET,
    right: width - STEP_INSET,
    bottom: height - STEP_INSET,
  };
  for (const { marker, runs } of steps) {
    const onScreen = runs.map((run) =>
      run.map((p): Point => {
        const { x, y } = instance.latLngToContainerPoint(
          instance.unproject(p, maxZoom),
        );
        return [x, y];
      }),
    );
    const { point, pinned } = placeStep(onScreen, box);
    // Put an isolated portal's number beside its pin so both remain clickable.
    const besidePortal = !pinned && onScreen.every((run) => run.length === 1);
    const labelPoint: Point = besidePortal
      ? [
          Math.min(point[0] + STEP_INSET, box.right),
          Math.max(point[1] - STEP_INSET, box.top),
        ]
      : point;
    marker.setLatLng(instance.containerPointToLatLng(labelPoint));
    marker.getElement()?.classList.toggle("is-pinned", pinned);
  }
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
