import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapCanvasHandlers } from "../src/map/MapCanvas";
import type { MapEdge, MapNode, WishlistItem } from "../src/domain/types";
import { initialDocuments } from "../src/storage/schema";
import App from "../src/App";
import { drawn } from "./paths";

// The real app; the Leaflet surface is replaced by buttons that send the same clicks.
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
    </div>
  ),
}));

afterEach(cleanup);

const item = (id: string, en: string, zh: string) => ({
  id,
  type: "weapon",
  paramId: 1,
  name: { en, "zh-TW": zh },
  dlc: false,
  icon: null,
});
const items = [
  item("weapon/1", "Longsword", "長劍"),
  item("weapon/2", "Buckler", "圓盾"),
  item("weapon/3", "Rusted Anchor", "生鏽的錨"),
];
const pin: MapNode = {
  id: "cellar",
  layer: "overworld",
  x: 0,
  y: 0,
  kind: "junction",
  label: "Gatefront cellar",
  ref: null,
  items: ["weapon/1"],
};
const attic: MapNode = {
  ...pin,
  id: "attic",
  label: "Attic",
  items: ["weapon/2", "weapon/3"],
};

const bosses = [
  {
    id: "boss/1",
    name: { en: "Margit, the Fell Omen", "zh-TW": "「惡兆」瑪爾基特" },
    dlc: false,
    flag: 9000,
  },
  {
    id: "boss/2",
    name: { en: "Tree Sentinel", "zh-TW": "大樹守衛" },
    dlc: false,
    flag: 9001,
  },
];

async function open(
  wishlist: WishlistItem[],
  map: { nodes?: MapNode[]; edges?: MapEdge[] } = {},
) {
  const documents = initialDocuments();
  documents.map.nodes = map.nodes ?? [pin, attic];
  documents.map.edges = map.edges ?? [];
  documents.player.profiles[0].wishlist = wishlist;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/game-data/catalog.json"
          ? { items, graces: [], bosses, places: [], npcs: [] }
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

const listed = () =>
  within(screen.getByRole("region", { name: "Playthrough tracker" }))
    .queryAllByRole("button", { name: /: acquired$/ })
    .map((b) => b.getAttribute("aria-label")!.replace(": acquired", ""));

describe("the route list", () => {
  const wishlist: WishlistItem[] = [
    { item: "weapon/1", pin: "cellar", status: "needed", note: "" },
    { item: "weapon/2", pin: "attic", status: "acquired", note: "" },
    {
      item: "weapon/3",
      pin: "attic",
      status: "needed",
      note: "behind the boss",
    },
  ];

  it("is searched by name in either language, pin name or note", async () => {
    await open(wishlist);
    expect(listed()).toEqual(["Longsword", "Buckler", "Rusted Anchor"]);
    const search = screen.getByRole("searchbox", {
      name: "Search the playthrough",
    });
    fireEvent.change(search, { target: { value: "圓盾" } });
    expect(listed()).toEqual(["Buckler"]);
    fireEvent.change(search, { target: { value: "cellar" } });
    expect(listed()).toEqual(["Longsword"]);
    fireEvent.change(search, { target: { value: "boss" } });
    expect(listed()).toEqual(["Rusted Anchor"]);
    fireEvent.change(search, { target: { value: "nothing like it" } });
    expect(screen.getByText("Nothing matches.")).toBeInTheDocument();
  });

  it("is filtered by status", async () => {
    await open(wishlist);
    const show = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(show).getByRole("button", { name: /Acquired/ }));
    expect(listed()).toEqual(["Buckler"]);
    fireEvent.click(within(show).getByRole("button", { name: /Needed/ }));
    expect(listed()).toEqual(["Longsword", "Rusted Anchor"]);
  });
});

describe("the playthrough tracker", () => {
  it("lists the bosses a walked path reaches and marks them beaten", async () => {
    await open([], {
      nodes: [
        { ...pin, bosses: ["boss/1"] },
        attic,
        { ...pin, id: "crypt", items: [], bosses: ["boss/2"] },
      ],
      edges: [{ ...drawn("e1", ["cellar", "attic"]), step: 1 }],
    });
    const tracker = screen.getByRole("region", { name: "Playthrough tracker" });
    // At a pin, its bosses come before its items; a boss off the walk isn't listed.
    expect(
      within(tracker)
        .getAllByRole("button", { name: /: (acquired|beaten)$/ })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Margit, the Fell Omen: beaten",
      "Longsword: acquired",
      "Buckler: acquired",
      "Rusted Anchor: acquired",
    ]);
    expect(
      screen.getByText("0 of 3 items acquired · 0 of 1 bosses beaten"),
    ).toBeInTheDocument();

    const margit = screen.getByRole("button", {
      name: "Margit, the Fell Omen: beaten",
    });
    fireEvent.click(margit);
    expect(margit).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("0 of 3 items acquired · 1 of 1 bosses beaten"),
    ).toBeInTheDocument();
    // A beaten boss counts as done in the filter.
    const show = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(show).getByRole("button", { name: /Acquired/ }));
    expect(
      within(tracker).getAllByRole("button", { name: /: (acquired|beaten)$/ }),
    ).toHaveLength(1);
  });
});

describe("the side panel", () => {
  it("switches to editing when something is selected, and back with the pencil", async () => {
    await open([
      { item: "weapon/1", pin: "cellar", status: "needed", note: "" },
    ]);
    const pencil = screen.getByRole("button", { name: "Edit" });
    // The same button reads "Done" while editing.
    expect(pencil).toHaveAttribute("aria-pressed", "false");
    // A list item opens its pin's details.
    fireEvent.click(
      within(
        screen.getByRole("region", { name: "Playthrough tracker" }),
      ).getAllByRole("button", { name: /^Longsword/ })[0],
    );
    expect(pencil).toHaveAttribute("aria-pressed", "true");
    expect(pencil).toHaveTextContent("Done");
    expect(
      screen.getByRole("region", { name: "Selected node" }),
    ).toBeInTheDocument();
    // Closing the details keeps editing, showing the playthrough.
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(
      screen.getByRole("region", { name: "Playthrough" }),
    ).toBeInTheDocument();
    fireEvent.click(pencil);
    expect(
      screen.getByRole("region", { name: "Playthrough tracker" }),
    ).toBeInTheDocument();
  });

  it("starts a new playthrough from the switcher, empty or from a template", async () => {
    await open([]);
    const switcher = screen.getByRole("combobox", { name: "Playthrough" });
    fireEvent.change(switcher, { target: { value: "new" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Start from" }), {
      target: { value: "Great Stars Guard Counter" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    // The new playthrough's map loads, then its details show.
    expect(
      await screen.findByRole("region", { name: "Playthrough" }),
    ).toHaveTextContent("Great Stars Guard Counter");
  });
});
