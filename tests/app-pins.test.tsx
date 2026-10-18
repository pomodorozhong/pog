import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapCanvasHandlers } from "../src/map/MapCanvas";
import type { MapEdge, MapNode } from "../src/domain/types";
import { initialDocuments } from "../src/storage/schema";
import App from "../src/App";

// The real app and pin details; the Leaflet surface is replaced by buttons
// that send the same clicks.
vi.mock("../src/map/MapCanvas", () => ({
  MapCanvas: (
    props: MapCanvasHandlers & { nodes: MapNode[]; edges: MapEdge[] },
  ) => (
    <div>
      <button onClick={() => props.onMapClick([50, 60])}>map</button>
      {props.nodes.map((node) => (
        <button key={node.id} onClick={() => props.onNodeClick(node.id)}>
          {node.id}
        </button>
      ))}
      <output data-testid="nodes">{JSON.stringify(props.nodes)}</output>
      <output data-testid="paths">{JSON.stringify(props.edges)}</output>
    </div>
  ),
}));

afterEach(cleanup);

const sword = {
  id: "weapon/1",
  type: "weapon",
  paramId: 1,
  name: { en: "Longsword", "zh-TW": "長劍" },
  dlc: false,
  icon: null,
};
const shield = {
  ...sword,
  id: "weapon/2",
  name: { en: "Buckler", "zh-TW": "圓盾" },
};

const elleh = {
  id: "grace/1",
  name: { en: "Church of Elleh", "zh-TW": "艾雷教堂" },
  dlc: false,
  layer: "overworld",
  x: 10,
  y: 20,
  flag: 1,
  legacy: false,
};
const cave = {
  id: "place/7",
  name: { en: "Murkwater Cave", "zh-TW": "濁流洞窟" },
  dlc: false,
};

async function open(
  nodes: MapNode[],
  graces: (typeof elleh)[] = [],
  edges: MapEdge[] = [],
) {
  const documents = initialDocuments();
  documents.map.nodes = nodes;
  documents.map.edges = edges;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/game-data/catalog.json"
          ? {
              items: [sword, shield],
              graces,
              places: [cave],
              npcs: [],
            }
          : url === "/game-data/map/index.json"
            ? Object.fromEntries(
                ["overworld", "underground", "dlc", "dlc-underground"].map(
                  (id) => [
                    id,
                    { mapId: id, tileSize: 256, maxZoom: 6, size: 10496 },
                  ],
                ),
              )
            : {
                revision: "test",
                state:
                  url === "/api/state/player"
                    ? documents.player
                    : documents.map,
              };
      return new Response(JSON.stringify(body));
    }),
  );
  render(<App />);
  await screen.findByRole("button", { name: "map" });
}

const mapNodes = (): MapNode[] =>
  JSON.parse(screen.getByTestId("nodes").textContent!);
const paths = (): MapEdge[] =>
  JSON.parse(screen.getByTestId("paths").textContent!);
const pick = (label: string, query: string, result: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: label }), {
    target: { value: query },
  });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(result) }));
};

describe("the pin tool", () => {
  it("places a junction that can become an entrance and hold items", async () => {
    await open([]);
    expect(screen.queryByRole("button", { name: /Junction/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pin N" }));
    fireEvent.click(screen.getByRole("button", { name: "map" }));
    expect(mapNodes()).toMatchObject([
      { kind: "junction", x: 50, y: 60, ref: null },
    ]);
    const kind = screen.getByRole("group", { name: "Kind" });
    expect(
      within(kind)
        .getAllByRole("button")
        .map((o) => o.textContent),
    ).toEqual(["Junction", "Entrance"]);

    pick("Add an item", "long", "Longsword");
    pick("Add an item", "buck", "Buckler");
    expect(mapNodes()[0].items).toEqual(["weapon/1", "weapon/2"]);
    expect(screen.getByText("Items (2)")).toBeInTheDocument();
    fireEvent.click(within(kind).getByRole("button", { name: "Entrance" }));
    expect(mapNodes()[0]).toMatchObject({
      kind: "entrance",
      items: ["weapon/1", "weapon/2"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Longsword" }));
    expect(mapNodes()[0].items).toEqual(["weapon/2"]);
  });

  it("turns an older map's item pin into a junction holding its item when edited", async () => {
    await open([
      {
        id: "old",
        layer: "overworld",
        x: 0,
        y: 0,
        kind: "item",
        label: "",
        ref: "weapon/1",
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "old" }));
    expect(screen.getByText("Items (1)")).toBeInTheDocument();
    pick("Add an item", "buck", "Buckler");
    expect(mapNodes()[0]).toMatchObject({
      kind: "junction",
      ref: null,
      items: ["weapon/1", "weapon/2"],
    });
  });
});

describe("pin notes", () => {
  it("keeps a pin's note on its own note path, removed when cleared", async () => {
    await open([
      {
        id: "j",
        layer: "overworld",
        x: 0,
        y: 0,
        kind: "junction",
        label: "",
        ref: null,
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "j" }));
    const note = screen.getByRole("textbox", { name: "Your note" });
    fireEvent.change(note, { target: { value: "Chest behind the wall" } });
    fireEvent.click(
      screen.getByRole("switch", { name: "Show note on the map" }),
    );
    expect(paths()).toMatchObject([
      {
        nodes: ["j"],
        note: "Chest behind the wall",
        showNote: true,
        step: null,
      },
    ]);
    expect(screen.queryByRole("region", { name: "Paths" })).toBeNull();
    fireEvent.click(
      screen.getByRole("switch", { name: "Show note on the map" }),
    );
    fireEvent.change(note, { target: { value: "" } });
    expect(paths()).toEqual([]);
  });
});

describe("a game grace", () => {
  it("takes a label, an entrance and items like a pin, but stays put", async () => {
    await open([], [elleh]);
    fireEvent.click(screen.getByRole("button", { name: "grace/1" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Label" }), {
      target: { value: "rest here" },
    });
    pick("Add an item", "Long", "Longsword");
    const kind = screen.getByRole("group", { name: "Kind" });
    fireEvent.click(within(kind).getByRole("button", { name: "Entrance" }));
    pick("Place name", "Murk", "Murkwater Cave");
    expect(
      screen.getByText("rest here · Entrance to Murkwater Cave"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete node" })).toBeNull();
    expect(mapNodes().find((n) => n.id === "grace/1")).toMatchObject({
      kind: "grace",
      x: 10,
      label: "rest here",
      place: "place/7",
      items: ["weapon/1"],
    });

    fireEvent.click(within(kind).getByRole("button", { name: "Grace" }));
    expect(mapNodes().find((n) => n.id === "grace/1")).not.toHaveProperty(
      "place",
    );
  });
});

describe("items on a walked path", () => {
  it("are on the wishlist without adding them", async () => {
    const pin = (id: string, items: string[]): MapNode => ({
      id,
      layer: "overworld",
      x: 0,
      y: 0,
      kind: "junction",
      label: "",
      ref: null,
      items,
    });
    const walked: MapEdge = {
      id: "e1",
      nodes: ["a", "b"],
      color: "gold",
      line: "solid",
      oneWay: false,
      note: "",
      showNote: false,
      step: 1,
    };
    await open(
      [pin("a", ["weapon/1"]), pin("b", []), pin("c", ["weapon/2"])],
      [],
      [walked],
    );
    const list = screen.getByRole("region", { name: "Items in route order" });
    expect(
      within(list).getByRole("button", { name: "Longsword: acquired" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(list).queryByRole("button", { name: "Buckler: acquired" }),
    ).toBeNull();

    // The walked pin shows its item's status; a pin on no path offers adding.
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(
      screen.queryByRole("button", { name: "Add to wishlist" }),
    ).toBeNull();
    expect(screen.getByRole("combobox", { name: "Wishlist" })).toHaveValue(
      "needed",
    );
    fireEvent.click(screen.getByRole("button", { name: "c" }));
    expect(
      screen.getByRole("button", { name: "Add to wishlist" }),
    ).toBeInTheDocument();
  });
});
