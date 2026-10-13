import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayerId, MapNode } from "../src/domain/types";
import type { GameData } from "../src/map/catalog";
import { MapCanvas } from "../src/map/MapCanvas";

vi.mock("../src/map/gestures", () => ({ enableGestures: () => () => {} }));

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
          language="en"
          data={data}
          undiscovered={new Set()}
          position={null}
          route={[]}
          stops={new Map()}
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
