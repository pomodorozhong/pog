import { act, cleanup, fireEvent, render } from "@testing-library/react";
import L, { type Map as LeafletMap } from "leaflet";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayerId, MapNode } from "../src/domain/types";
import { drawn } from "./paths";
import type { GameData } from "../src/map/catalog";
import { MapCanvas } from "../src/map/MapCanvas";

const leaflet = vi.hoisted(() => ({ current: null as LeafletMap | null }));
vi.mock("../src/map/gestures", () => ({
  enableGestures: (map: LeafletMap) => {
    leaflet.current = map;
    return () => {};
  },
}));

afterEach(cleanup);

const nodes: MapNode[] = [
  {
    id: "surface",
    layer: "overworld",
    x: 100,
    y: 100,
    kind: "junction",
    label: "",
    ref: null,
  },
  {
    id: "below",
    layer: "underground",
    x: 100,
    y: 100,
    kind: "junction",
    label: "",
    ref: null,
  },
];
const info = { mapId: "test", tileSize: 256, maxZoom: 0, size: 1000 };
const data: GameData = {
  catalog: { items: [], graces: [], bosses: [], places: [], npcs: [] },
  layers: {
    overworld: info,
    underground: info,
    dlc: info,
    "dlc-underground": info,
  },
  byId: new Map(),
  uniquePlaces: [],
  graceFlags: new Map(),
};

describe("cross-layer waygate numbers", () => {
  it.each<LayerId>(["overworld", "underground"])(
    "shows one clickable number at the local endpoint on %s",
    (layer) => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        600,
      );
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
        400,
      );
      const onEdgeClick = vi.fn();
      const { container } = render(
        <MapCanvas
          layer={layer}
          info={info}
          view={{ layer, x: 100, y: 100, zoom: 1 }}
          nodes={nodes}
          edges={[{ ...drawn("gate", ["surface", "below"]), step: 1 }]}
          selection={null}
          draft={null}
          editable={false}
          drawing={false}
          hideUnusedGraces={false}
          graceNames="auto"
          language="en"
          data={data}
          undiscovered={new Set()}
          unfinished={new Set()}
          position={null}
          beaten={new Set()}
          route={[]}
          stops={new Map()}
          routeNodes={new Set()}
          highlight={null}
          onMapClick={vi.fn()}
          onNodeClick={vi.fn()}
          onNodeMove={vi.fn()}
          onEdgeClick={onEdgeClick}
          onViewChange={vi.fn()}
        />,
      );
      const numbers = container.querySelectorAll(".path-step");
      expect(numbers).toHaveLength(1);
      expect(numbers[0]).toHaveTextContent("1");
      expect(numbers[0]).not.toHaveClass("is-pinned");
      fireEvent.click(numbers[0]);
      expect(onEdgeClick).toHaveBeenCalledWith("gate");
      expect(container.querySelectorAll(".map-node.has-portal")).toHaveLength(
        1,
      );
    },
  );
});

const graceNames = ["start", "middle", "end", "unused"];
// Game graces, named by the catalog; a label is something the player added.
const graceNodes: MapNode[] = graceNames.map((_, i) => ({
  id: `grace/${i + 1}`,
  layer: "overworld",
  x: 100 + i * 20,
  y: 100,
  kind: "grace",
  label: "",
  ref: `grace/${i + 1}`,
}));
graceNames.forEach((name, i) =>
  data.byId.set(`grace/${i + 1}`, {
    id: `grace/${i + 1}`,
    name: { en: name, "zh-TW": name },
    dlc: false,
  }),
);
const canvasProps = (): ComponentProps<typeof MapCanvas> => ({
  layer: "overworld",
  info,
  view: { layer: "overworld", x: 100, y: 100, zoom: 3 },
  nodes: [...graceNodes, ...nodes],
  edges: [],
  selection: null,
  draft: null,
  editable: true,
  drawing: false,
  hideUnusedGraces: false,
  graceNames: "auto",
  language: "en",
  data,
  undiscovered: new Set(),
  unfinished: new Set(),
  position: null,
  beaten: new Set(),
  route: [],
  stops: new Map(),
  routeNodes: new Set(),
  highlight: null,
  onMapClick: vi.fn(),
  onNodeClick: vi.fn(),
  onNodeMove: vi.fn(),
  onEdgeClick: vi.fn(),
  onViewChange: vi.fn(),
});

describe("path options", () => {
  it("shows a path's note under its step number only when asked, as plain text", () => {
    const path = {
      ...drawn("walk", ["grace/1", "grace/2"]),
      note: "<b>Needs</b> the key",
      step: 1,
    };
    const { container, rerender } = render(
      <MapCanvas {...canvasProps()} edges={[path]} />,
    );
    expect(container.querySelector(".step-note")).toBeNull();
    rerender(
      <MapCanvas {...canvasProps()} edges={[{ ...path, showNote: true }]} />,
    );
    const note = container.querySelector(".path-step .step-note")!;
    expect(note).toHaveTextContent("<b>Needs</b> the key");
    expect(note.previousElementSibling).toHaveTextContent("1");
    expect(note.querySelector("b")).toBeNull();
  });
});

describe("direction arrows", () => {
  it("point along every path, and run on the one the player is on", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    const edges = [
      { ...drawn("next", ["grace/1", "grace/3"]), step: 2 },
      { ...drawn("other", ["grace/4", "grace/2"]), step: 1 },
    ];
    const { container, rerender } = render(
      <MapCanvas {...canvasProps()} edges={edges} position="grace/1" />,
    );
    const moving = container.querySelectorAll(".path-arrow.is-moving");
    const still = container.querySelectorAll(".path-arrow:not(.is-moving)");
    expect(moving.length).toBeGreaterThan(0);
    // They move along the path rather than sit still.
    expect(moving[0].querySelector("span")!.getAttribute("style")).toMatch(
      /offset-path:path\('M[^']+L[^']+'\)/,
    );
    expect(still.length).toBeGreaterThan(0);
    // The path from grace/4 back to grace/2 points left.
    expect(still[0].querySelector("span")!.style.transform).toBe(
      "rotate(180deg)",
    );

    rerender(<MapCanvas {...canvasProps()} edges={edges} position={null} />);
    expect(container.querySelectorAll(".path-arrow.is-moving")).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("pause the moving arrows while a gesture zooms", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    const edges = [{ ...drawn("next", ["grace/1", "grace/3"]), step: 1 }];
    const { container } = render(
      <MapCanvas {...canvasProps()} edges={edges} position="grace/1" />,
    );
    const spans = () => [
      ...container.querySelectorAll<HTMLElement>(".path-arrow.is-moving span"),
    ];
    const moving = () =>
      spans().filter((s) => s.getAttribute("style")!.includes("offset-path"));
    // The far end of the line the arrows follow; its start is the map's center.
    const end = () => {
      const [, x, y] = /L([-\d.]+) ([-\d.]+)'\)/.exec(
        moving()[0].getAttribute("style")!,
      )!;
      return L.point(Number(x), Number(y));
    };
    const map = leaflet.current!;
    const internal = map as unknown as {
      _move: (...args: unknown[]) => void;
      _moveEnd: (zoomChanged: boolean) => void;
    };
    const from = map.containerPointToLatLng(end());
    // A pinch moves the map a frame at a time, as the gestures do. Zooming
    // out keeps the line's end on screen, where it isn't clipped.
    act(() =>
      internal._move(map.getCenter(), map.getZoom() - 0.5, {
        pinch: true,
        round: false,
      }),
    );
    // Paused: still arrows on the map, which a zoom moves along with it.
    expect(moving()).toHaveLength(0);
    expect(spans().length).toBeGreaterThan(0);
    act(() =>
      internal._move(map.getCenter(), map.getZoom() - 0.25, {
        pinch: true,
        round: false,
      }),
    );
    expect(moving()).toHaveLength(0);
    // Once the zoom ends they move again, along the path where it is now.
    act(() => internal._moveEnd(true));
    expect(end().distanceTo(map.latLngToContainerPoint(from))).toBeLessThan(
      0.2,
    );
    vi.restoreAllMocks();
  });
});

describe("grace visibility", () => {
  it("preserves paths, step numbers and retained grace markers when the filter changes", () => {
    const props = {
      ...canvasProps(),
      view: { layer: "overworld" as const, x: 100, y: 100, zoom: 6 },
      edges: [{ ...drawn("walk", ["grace/1", "grace/2", "grace/3"]), step: 1 }],
    };
    const { container, rerender } = render(<MapCanvas {...props} />);
    const step = container.querySelector(".path-step")!;
    const grace = container.querySelector(".map-node--grace")!;
    const label = [...container.querySelectorAll(".node-label--grace")].find(
      (element) => element.textContent === "start",
    )!;
    const path = container.querySelector(".leaflet-overlay-pane path")!;
    expect(step).not.toBeNull();
    expect(path).not.toBeNull();
    expect(label).not.toBeUndefined();
    rerender(<MapCanvas {...props} hideUnusedGraces />);
    expect(container.querySelectorAll(".map-node--grace")).toHaveLength(3);
    expect(container.querySelector(".path-step")).toBe(step);
    expect(container.querySelector(".map-node--grace")).toBe(grace);
    expect(label.isConnected).toBe(true);
    expect(container.querySelector(".leaflet-overlay-pane path")).toBe(path);
    rerender(<MapCanvas {...props} />);
    expect(container.querySelectorAll(".map-node--grace")).toHaveLength(4);
    expect(container.querySelector(".path-step")).toBe(step);
    expect(container.querySelector(".map-node--grace")).toBe(grace);
    expect(label.isConnected).toBe(true);
  });

  it("keeps every pin on a drawn path, including an inner grace, and updates with the map", () => {
    const props = canvasProps();
    const { container, rerender } = render(<MapCanvas {...props} />);
    const visible = () => container.querySelectorAll(".map-node--grace");
    expect(visible()).toHaveLength(4);
    const filtered = {
      ...props,
      hideUnusedGraces: true,
      edges: [{ ...drawn("walk", ["grace/1", "grace/2", "grace/3"]), step: 1 }],
    };
    rerender(<MapCanvas {...filtered} />);
    expect(visible()).toHaveLength(3);
    // A profile with no paths hides every grace, but keeps its junction.
    rerender(<MapCanvas {...filtered} edges={[]} />);
    expect(visible()).toHaveLength(0);
    expect(container.querySelectorAll(".map-node--junction")).toHaveLength(1);
    // Restoring a path (Undo or switching back) restores its markers.
    rerender(<MapCanvas {...filtered} />);
    expect(visible()).toHaveLength(3);
  });

  it("keeps position and selection visible, and reveals clickable graces before drawing starts", () => {
    const props = { ...canvasProps(), hideUnusedGraces: true };
    const { container, rerender } = render(
      <MapCanvas
        {...props}
        position="grace/1"
        selection={{ kind: "node", id: "grace/2" }}
      />,
    );
    expect(container.querySelectorAll(".map-node--grace")).toHaveLength(2);
    rerender(<MapCanvas {...props} drawing />);
    const graces = container.querySelectorAll(".map-node--grace");
    expect(graces).toHaveLength(4);
    fireEvent.click(graces[3]);
    expect(props.onNodeClick).toHaveBeenCalledWith("grace/4");
    rerender(<MapCanvas {...props} />);
    expect(container.querySelectorAll(".map-node--grace")).toHaveLength(0);
  });
});

describe("grace names", () => {
  it("shows ordinary grace names only at very close zoom and important names at every zoom", () => {
    const props = canvasProps();
    const { container, rerender } = render(
      <MapCanvas
        {...props}
        position="grace/1"
        routeNodes={new Set(["grace/2"])}
        selection={{ kind: "node", id: "grace/3" }}
      />,
    );
    const labels = () =>
      [...container.querySelectorAll(".node-label--grace")].map(
        (element) => element.textContent,
      );
    expect(labels()).toEqual(["start", "middle", "end"]);
    const unused = container.querySelectorAll(".map-node--grace")[3];
    fireEvent.mouseOver(unused);
    expect(labels()).toContain("unused");
    fireEvent.mouseOut(unused);
    expect(labels()).not.toContain("unused");
    act(() => leaflet.current!.setZoom(4, { animate: false }));
    expect(labels()).toEqual(["start", "middle", "end"]);
    fireEvent.mouseOver(unused);
    expect(labels()).toContain("unused");
    fireEvent.mouseOut(unused);
    act(() => leaflet.current!.setZoom(5, { animate: false }));
    expect(labels()).toEqual(["start", "middle", "end"]);
    act(() => leaflet.current!.setZoom(6, { animate: false }));
    expect(labels()).toHaveLength(4);
    rerender(<MapCanvas {...props} />);
    expect(labels()).toHaveLength(4);
    act(() => leaflet.current!.setZoom(3, { animate: false }));
    expect(labels()).toEqual([]);
  });

  it("applies the detail choice immediately while preserving important names", () => {
    const props = { ...canvasProps(), position: "grace/1" };
    const { container, rerender } = render(<MapCanvas {...props} />);
    const labels = () =>
      [...container.querySelectorAll(".node-label--grace")].map(
        (element) => element.textContent,
      );
    expect(labels()).toEqual(["start"]);
    rerender(<MapCanvas {...props} graceNames="always" />);
    expect(labels()).toHaveLength(4);
    act(() => leaflet.current!.setZoom(8, { animate: false }));
    rerender(<MapCanvas {...props} graceNames="hover" />);
    expect(labels()).toEqual(["start"]);
    fireEvent.mouseOver(container.querySelectorAll(".map-node--grace")[3]);
    expect(labels()).toContain("unused");
    rerender(<MapCanvas {...props} />);
    expect(labels()).toHaveLength(4);
  });
});

describe("pin notes and items", () => {
  const notePath = (pin: string, showNote: boolean) => ({
    ...drawn(`note-${pin}`, [pin]),
    note: "<i>Chest</i> here",
    showNote,
    step: null,
  });

  it("shows a pin's note below it only when asked, as plain text, with no step number", () => {
    const { container, rerender } = render(
      <MapCanvas {...canvasProps()} edges={[notePath("surface", false)]} />,
    );
    expect(container.querySelector(".pin-note")).toBeNull();
    expect(container.querySelector(".path-step")).toBeNull();
    rerender(
      <MapCanvas {...canvasProps()} edges={[notePath("surface", true)]} />,
    );
    const note = container.querySelector(".pin-note")!;
    expect(note).toHaveTextContent("<i>Chest</i> here");
    expect(note.querySelector("i")).toBeNull();
    expect(container.querySelector(".path-step")).toBeNull();
  });

  it("keeps a grace with a note visible when unused graces are hidden", () => {
    const { container } = render(
      <MapCanvas
        {...canvasProps()}
        hideUnusedGraces
        edges={[notePath("grace/2", true)]}
      />,
    );
    expect(container.querySelectorAll(".map-node--grace")).toHaveLength(1);
    expect(container.querySelector(".pin-note")).toHaveTextContent("Chest");
  });

  it("marks a pin holding items with how many more it holds", () => {
    const [surface] = nodes;
    const { container } = render(
      <MapCanvas
        {...canvasProps()}
        nodes={[{ ...surface, items: ["weapon/1", "weapon/2", "weapon/3"] }]}
      />,
    );
    const pin = container.querySelector(".map-node.has-items")!;
    expect(pin).toHaveTextContent("+2");
  });

  it("keeps a grace that holds items a grace, with a badge, and shows it when unused graces are hidden", () => {
    const [start, middle] = graceNodes;
    const { container } = render(
      <MapCanvas
        {...canvasProps()}
        hideUnusedGraces
        nodes={[{ ...start, items: ["weapon/1", "weapon/2"] }, middle]}
      />,
    );
    const graces = container.querySelectorAll(".map-node--grace");
    expect(graces).toHaveLength(1);
    expect(graces[0]).not.toHaveClass("has-items");
    expect(graces[0].querySelector(".grace-item")).not.toBeNull();
    expect(graces[0]).toHaveTextContent("+1");
  });
});

describe("bosses on the map", () => {
  it("shows a skull pin, or a badge with how many, faded once all are beaten", () => {
    const withBosses: MapNode[] = [
      { ...graceNodes[0], bosses: ["boss/1", "boss/2"] },
      { ...nodes[0], bosses: ["boss/3"] },
    ];
    const props = { ...canvasProps(), nodes: withBosses };
    const { container, rerender } = render(<MapCanvas {...props} />);
    const pin = container.querySelector(".map-node--junction")!;
    expect(pin).toHaveClass("has-bosses");
    expect(pin.querySelector("svg.boss-icon")).not.toBeNull();
    const badge = container.querySelector(".map-node--grace .boss-badge")!;
    expect(badge.querySelector("svg.boss-icon")).not.toBeNull();
    expect(badge).toHaveTextContent("2");
    expect(container.querySelectorAll(".bosses-beaten")).toHaveLength(0);

    rerender(<MapCanvas {...props} beaten={new Set(["boss/1", "boss/3"])} />);
    expect(container.querySelector(".map-node--junction")).toHaveClass(
      "bosses-beaten",
    );
    expect(container.querySelector(".map-node--grace")).not.toHaveClass(
      "bosses-beaten",
    );
  });
});
