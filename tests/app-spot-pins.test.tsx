import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../src/App";
import type { MapCanvas } from "../src/map/MapCanvas";
import { addProfile } from "../src/profiles/profiles";
import { initialDocuments } from "../src/storage/schema";

const canvas = vi.hoisted(() => ({
  props: null as ComponentProps<typeof MapCanvas> | null,
}));
vi.mock("../src/map/MapCanvas", () => ({
  MapCanvas: (props: ComponentProps<typeof MapCanvas>) => {
    canvas.props = props;
    return <div data-testid="canvas" />;
  },
}));
afterEach(cleanup);

const TEAR = "goods/10020";
const SEED = "goods/10010";
const MOONVEIL = "weapon/2010000";
const item = (id: string, en: string) => ({
  id,
  type: id.split("/")[0],
  paramId: 1,
  name: { en, "zh-TW": en },
  dlc: false,
  icon: null,
});
const spot = (lot: number, item: string, x: number, layer = "overworld") => ({
  lot,
  flag: lot,
  items: [item],
  layer,
  x,
  y: 700,
  legacy: false,
});
const catalog = {
  items: [
    item(TEAR, "Sacred Tear"),
    item(SEED, "Golden Seed"),
    item(MOONVEIL, "Moonveil"),
  ],
  graces: [],
  bosses: [],
  // The tear has one spot; the seed three, one of them underground.
  pickups: [
    spot(1, TEAR, 1000),
    spot(2, SEED, 2000),
    spot(3, SEED, 3000),
    spot(4, SEED, 500, "underground"),
  ],
  places: [],
  npcs: [],
};

function serve(two = false) {
  const documents = initialDocuments();
  if (two) {
    documents.player = addProfile(documents.player);
    documents.player.activeProfile = "profile-1";
  }
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      const { state } = JSON.parse(options.body as string);
      if (url === "/api/state/player") documents.player = state;
      else documents.map = state;
      return new Response(JSON.stringify({ revision: "saved" }));
    }
    const body =
      url === "/game-data/catalog.json"
        ? catalog
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
                  : initialDocuments().map,
            };
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal("fetch", request);
  return documents;
}

async function addFromSearch(name: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Add to wishlist" }), {
    target: { value: name },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: new RegExp(name) }),
  );
}

it("places a wishlisted item's pin on its only spot in the game", async () => {
  const documents = serve();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await addFromSearch("Sacred Tear");
  expect(
    screen.getByText("Sacred Tear is on the wishlist, not attached to a pin."),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Place pin from game data" }),
  );
  const pin = canvas.props!.nodes.find((n) => n.items?.includes(TEAR));
  expect(pin).toMatchObject({ layer: "overworld", x: 1000, y: 700 });
  expect(canvas.props!.selection).toEqual({ kind: "node", id: pin!.id });
  await waitFor(() =>
    expect(documents.player.profiles[0].wishlist).toEqual([
      { item: TEAR, status: "needed", note: "", pin: pin!.id },
    ]),
  );
  expect(
    screen.queryByText(/is on the wishlist, not attached to a pin/),
  ).toBeNull();
});

it("lets the player choose one of several spots on the map, or cancel", async () => {
  serve();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await addFromSearch("Golden Seed");
  fireEvent.click(
    screen.getByRole("button", { name: "Place pin from game data (3 spots)" }),
  );
  expect(
    screen.getByText("Choose one of the 3 spots of Golden Seed for its pin."),
  ).toBeInTheDocument();
  expect(canvas.props!.spots.map((s) => s.lot)).toEqual([2, 3, 4]);
  expect(canvas.props!.onSpotChoose).toBeDefined();
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(canvas.props!.onSpotChoose).toBeUndefined();

  // Offered again from the entry, which still has no pin.
  fireEvent.click(screen.getByRole("button", { name: "Notes and status" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Place pin from game data (3 spots)" }),
  );
  // The underground spot is a layer away.
  fireEvent.click(
    screen.getByRole("button", { name: "Lands Between · Underground (1)" }),
  );
  await waitFor(() => expect(canvas.props!.layer).toBe("underground"));
  act(() => canvas.props!.onSpotChoose!(canvas.props!.spots[2]));
  expect(
    canvas.props!.nodes.find((n) => n.items?.includes(SEED)),
  ).toMatchObject({ layer: "underground", x: 500 });
  expect(canvas.props!.onSpotChoose).toBeUndefined();
});

it("keeps manual pins for an item the game data doesn't place", async () => {
  serve();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await addFromSearch("Moonveil");
  expect(screen.getByText("Attach it from a pin's Items.")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Place pin from game data/ }),
  ).toBeNull();
});

it("ends choosing a spot, and the offer after a search, when the playthrough changes", async () => {
  const documents = serve(true);
  const [first, other] = documents.player.profiles.map((p) => p.id);
  const playthrough = (id: string) =>
    fireEvent.change(screen.getByRole("combobox", { name: "Playthrough" }), {
      target: { value: id },
    });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await addFromSearch("Golden Seed");
  const offer = "Golden Seed is on the wishlist, not attached to a pin.";
  expect(screen.getByText(offer)).toBeInTheDocument();
  playthrough(other);
  await waitFor(() => expect(screen.queryByText(offer)).toBeNull());

  playthrough(first);
  fireEvent.click(
    await screen.findByRole("button", { name: "Notes and status" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Place pin from game data (3 spots)" }),
  );
  expect(canvas.props!.onSpotChoose).toBeDefined();
  playthrough(other);
  await waitFor(() => expect(canvas.props!.onSpotChoose).toBeUndefined());
  expect(screen.queryByText(/Choose one of the/)).toBeNull();
});
