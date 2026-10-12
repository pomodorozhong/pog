import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useLayoutEffect, useRef } from "react";
import type {
  LayerId,
  Language,
  MapEdge,
  MapNode,
  MapView,
  Point,
} from "../domain/types";
import {
  displayName,
  iconUrl,
  isItem,
  type GameData,
  type MapLayerInfo,
} from "./catalog";
import type { RouteLine } from "../routing/order";
import { edgeLine, isOneWay } from "./editing";
import { enableGestures } from "./gestures";
import { EDGE_STYLE, NODE_SYMBOL } from "./style";

export type Selection = { kind: "node" | "edge"; id: string } | null;
export type Draft = { from: string; points: Point[] } | null;

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
  draft: Draft;
  editable: boolean;
  language: Language;
  data: GameData;
  /** Graces on the map not yet discovered in this playthrough. */
  undiscovered: Set<string>;
  /** The node the player is at, or null. */
  position: string | null;
  /** The planned route, drawn over the paths. */
  route: RouteLine[];
  /** Route stop numbers, by node. */
  stops: Map<string, number>;
};

const LABEL_ZOOM = 4;

export function MapCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.LayerGroup | null>(null);
  const rubberBand = useRef<L.Polyline | null>(null);
  // Leaflet handlers are bound once; they read the latest props through this ref.
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const toLatLng = ([x, y]: Point) =>
    map.current!.unproject([x, y], latest.current.info.maxZoom);
  const toPoint = (latLng: L.LatLng): Point => {
    const p = map.current!.project(latLng, latest.current.info.maxZoom);
    return [Math.round(p.x), Math.round(p.y)];
  };

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
      const { draft, nodes } = latest.current;
      const from = draft && nodes.find((n) => n.id === draft.from);
      if (!draft || !from) return;
      const last = draft.points[draft.points.length - 1] ?? [from.x, from.y];
      rubberBand.current!.setLatLngs([toLatLng(last), event.latlng]);
    });
    const report = () => {
      const center = toPoint(instance.getCenter());
      latest.current.onViewChange({
        layer: latest.current.layer,
        x: center[0],
        y: center[1],
        zoom: instance.getZoom(),
      });
      instance
        .getContainer()
        .classList.toggle("show-labels", instance.getZoom() >= LABEL_ZOOM);
    };
    // Gestures move the map every frame; report the view once it settles.
    let reportTimer: ReturnType<typeof setTimeout> | undefined;
    instance.on("moveend zoomend", () => {
      clearTimeout(reportTimer);
      reportTimer = setTimeout(report, 150);
    });
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
    language,
    data,
    undiscovered,
    position,
    route,
    stops,
  } = props;
  useEffect(() => {
    const group = overlay.current!;
    group.clearLayers();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const portalEnds = new Set<string>();

    for (const edge of edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) continue;
      if (from.layer !== to.layer) {
        portalEnds.add(from.id);
        portalEnds.add(to.id);
        continue;
      }
      if (from.layer !== layer) continue;
      const selected = selection?.kind === "edge" && selection.id === edge.id;
      const style = EDGE_STYLE[edge.type];
      const line = edgeLine(edge, from, to).map(toLatLng);
      if (selected)
        L.polyline(line, {
          color: "#fff",
          weight: style.weight + 6,
          opacity: 0.5,
          interactive: false,
        }).addTo(group);
      L.polyline(line, { ...style, opacity: 0.95 })
        .on("click", (event) => {
          L.DomEvent.stop(event);
          latest.current.onEdgeClick(edge.id);
        })
        .addTo(group);
      if (isOneWay(edge.type))
        addArrow(
          group,
          line[line.length - 2],
          line[line.length - 1],
          style.color,
        );
    }

    for (const line of route) {
      if (line.layer !== layer) continue;
      L.polyline(line.points.map(toLatLng), {
        color: "#7fd1ff",
        weight: 7,
        opacity: line.guess ? 0.6 : 0.75,
        dashArray: line.guess ? "2 10" : undefined,
        lineCap: "round",
        interactive: false,
      }).addTo(group);
    }

    if (draft) {
      const from = byId.get(draft.from);
      if (from?.layer === layer)
        L.polyline([[from.x, from.y] as Point, ...draft.points].map(toLatLng), {
          color: "#eee9db",
          dashArray: "4 6",
          weight: 3,
          interactive: false,
        }).addTo(group);
      rubberBand.current!.addTo(group);
    } else rubberBand.current!.setLatLngs([]);

    for (const node of nodes) {
      if (node.layer !== layer) continue;
      const selected = selection?.kind === "node" && selection.id === node.id;
      const name = displayName(data, node, language);
      const entry = node.ref ? data.byId.get(node.ref) : undefined;
      const image =
        entry && isItem(entry) && entry.icon
          ? `<img src="${iconUrl(entry.icon)}" alt="">`
          : NODE_SYMBOL[node.kind];
      const classes = [
        "map-node",
        `map-node--${node.kind}`,
        selected && "is-selected",
        portalEnds.has(node.id) && "has-portal",
        draft?.from === node.id && "is-draft-start",
        undiscovered.has(node.id) && "is-undiscovered",
        position === node.id && "is-position",
      ];
      const stop = stops.get(node.id);
      const marker = L.marker(toLatLng([node.x, node.y]), {
        icon: L.divIcon({
          className: classes.filter(Boolean).join(" "),
          html:
            stop === undefined
              ? image
              : `${image}<span class="stop-badge">${stop}</span>`,
          iconSize: undefined,
        }),
        draggable: editable,
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
        )
        .addTo(group);
      if (name)
        marker.bindTooltip(escapeHtml(name), {
          permanent: node.kind !== "junction",
          direction: "right",
          offset: [10, 0],
          className: `node-label node-label--${node.kind}`,
        });
    }
  }, [
    nodes,
    edges,
    selection,
    draft,
    editable,
    language,
    data,
    layer,
    undiscovered,
    position,
    route,
    stops,
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

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
