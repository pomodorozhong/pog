import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { Map as LeafletMap } from "leaflet";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayerId, MapNode } from "../src/domain/types";
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
  catalog: { items: [], graces: [], places: [], npcs: [] },
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
          edges={[
            {
              id: "gate",
              nodes: ["surface", "below"],
              type: "waygate",
              note: "",
              step: 1,
            },
          ]}
          selection={null}
          draft={null}
          editable={false}
          drawing={false}
          hideUnusedGraces={false}
          language="en"
          data={data}
          undiscovered={new Set()}
          position={null}
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

const graceNodes: MapNode[] = ["start", "middle", "end", "unused"].map(
  (id, i) => ({
    id: `grace/${i + 1}`,
    layer: "overworld",
    x: 100 + i * 20,
    y: 100,
    kind: "grace",
    label: id,
    ref: null,
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
  language: "en",
  data,
  undiscovered: new Set(),
  position: null,
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

describe("grace visibility", () => {
  it("keeps every pin on a drawn path, including an inner grace, and updates with the map", () => {
    const props = canvasProps();
    const { container, rerender } = render(<MapCanvas {...props} />);
    const visible = () => container.querySelectorAll(".map-node--grace");
    expect(visible()).toHaveLength(4);
    const filtered = {
      ...props,
      hideUnusedGraces: true,
      edges: [
        {
          id: "walk",
          nodes: ["grace/1", "grace/2", "grace/3"],
          type: "road" as const,
          note: "",
          step: 1,
        },
      ],
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
  it("keeps ordinary grace names on hover at every zoom and important names visible", () => {
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
    act(() => leaflet.current!.setZoom(8, { animate: false }));
    expect(labels()).toEqual(["start", "middle", "end"]);
    rerender(<MapCanvas {...props} />);
    expect(labels()).toEqual([]);
    act(() => leaflet.current!.setZoom(3, { animate: false }));
    expect(labels()).toEqual([]);
  });
});
