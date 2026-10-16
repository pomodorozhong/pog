import {
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

it("persists one filter across profiles and reloads, while routing still uses hidden graces", async () => {
  const documents = initialDocuments();
  documents.player.profiles[0].progress = {
    position: "grace/1",
    flags: [101, 102],
  };
  documents.player.profiles[0].wishlist = [
    { item: "weapon/1", status: "needed", note: "" },
  ];
  documents.player = addProfile(documents.player);
  const second = documents.player.activeProfile;
  documents.player.activeProfile = "profile-1";
  documents.map.nodes = [
    {
      id: "item",
      layer: "overworld",
      x: 10001,
      y: 0,
      kind: "item",
      label: "",
      ref: "weapon/1",
    },
  ];
  const catalog = {
    items: [
      {
        id: "weapon/1",
        type: "weapon",
        name: { en: "Target", "zh-TW": "目標" },
        dlc: false,
        icon: null,
      },
    ],
    graces: [0, 10000].map((x, i) => ({
      id: `grace/${i + 1}`,
      name: { en: `Grace ${i + 1}`, "zh-TW": `賜福 ${i + 1}` },
      dlc: false,
      layer: "overworld",
      x,
      y: 0,
      flag: 101 + i,
      legacy: false,
    })),
    places: [],
    npcs: [],
  };
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "PUT") {
      const { state } = JSON.parse(options.body as string);
      if (url === "/api/state/player") documents.player = state;
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
                  : url.endsWith("profile-1")
                    ? documents.map
                    : initialDocuments().map,
            };
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal("fetch", request);
  const first = render(<App />);
  const toggle = await screen.findByRole("button", {
    name: "Hide graces without paths",
  });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(toggle.closest('[role="toolbar"]')).toBeNull();
  const details = screen.getByRole("button", { name: "Details" });
  expect(details).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(details);
  expect(
    screen.getByRole("region", { name: "Map details" }),
  ).not.toContainElement(toggle);
  const names = screen.getByRole("combobox", { name: "Grace names" });
  expect(names).toHaveValue("auto");
  fireEvent.change(names, { target: { value: "hover" } });
  expect(canvas.props!.graceNames).toBe("hover");
  fireEvent.keyDown(names, { key: "Escape" });
  expect(details).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText(/fast travel to Grace 2/)).toBeInTheDocument();
  expect(canvas.props!.routeNodes.has("grace/2")).toBe(true);
  fireEvent.click(toggle);
  expect(canvas.props!.hideUnusedGraces).toBe(true);
  expect(canvas.props!.nodes.map((node) => node.id)).toContain("grace/2");
  expect(screen.getByText(/fast travel to Grace 2/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Draw path P" }));
  expect(canvas.props!.drawing).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Select V" }));
  expect(canvas.props!.drawing).toBe(false);
  fireEvent.change(screen.getByRole("combobox", { name: "Playthrough" }), {
    target: { value: second },
  });
  await waitFor(() => expect(canvas.props!.nodes).toHaveLength(2));
  expect(
    screen.getByRole("button", { name: "Hide graces without paths" }),
  ).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => {
    expect(documents.player.hideUnusedGraces).toBe(true);
    expect(documents.player.graceNames).toBe("hover");
    expect(documents.player.activeProfile).toBe(second);
  });
  first.unmount();
  render(<App />);
  expect(
    await screen.findByRole("button", { name: "Hide graces without paths" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.getByRole("combobox", { name: "Grace names" })).toHaveValue(
    "hover",
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "zh-TW" },
  });
  expect(
    screen.getByRole("button", { name: "隱藏沒有路徑經過的賜福" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("combobox", { name: "賜福名稱" })).toHaveValue(
    "hover",
  );
});
