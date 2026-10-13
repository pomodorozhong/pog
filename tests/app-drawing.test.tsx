import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapCanvasHandlers } from "../src/map/MapCanvas";
import type { MapEdge, MapNode } from "../src/domain/types";
import { initialDocuments } from "../src/storage/schema";
import App from "../src/App";

// Keep the real app controls, drawing actions and history; replace only the
// Leaflet surface with buttons that send the same node-click events.
vi.mock("../src/map/MapCanvas", () => ({
  MapCanvas: (
    props: MapCanvasHandlers & { nodes: MapNode[]; edges: MapEdge[] },
  ) => (
    <div>
      {props.nodes.map((node) => (
        <button key={node.id} onClick={() => props.onNodeClick(node.id)}>
          {node.id}
        </button>
      ))}
      <output data-testid="paths">{JSON.stringify(props.edges)}</output>
    </div>
  ),
}));

afterEach(cleanup);

async function startDrawing() {
  const documents = initialDocuments();
  documents.map.nodes = ["a", "b", "c", "d", "e"].map((id, i) => ({
    id,
    layer: "overworld",
    x: i * 100,
    y: 0,
    kind: "junction",
    label: "",
    ref: null,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body =
        url === "/game-data/catalog.json"
          ? { items: [], graces: [], places: [], npcs: [] }
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
  await screen.findByRole("button", { name: "a" });
  fireEvent.click(screen.getByRole("button", { name: "Draw path P" }));
}

const clickPin = (id: string) =>
  fireEvent.click(screen.getByRole("button", { name: id }));
const paths = (): MapEdge[] =>
  JSON.parse(screen.getByTestId("paths").textContent!);

describe("drawing after toolbar history changes", () => {
  it("starts a fresh path after Undo removes a path through existing pins", async () => {
    await startDrawing();
    clickPin("a");
    clickPin("b");
    expect(paths().map((edge) => edge.nodes)).toEqual([["a", "b"]]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(paths()).toEqual([]);
    clickPin("c");
    clickPin("d");
    expect(paths().map((edge) => edge.nodes)).toEqual([["c", "d"]]);
  });

  it("ends a partial drawing before Redo restores another path", async () => {
    await startDrawing();
    clickPin("a");
    clickPin("b");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    clickPin("c");

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(paths().map((edge) => edge.nodes)).toEqual([["a", "b"]]);
    clickPin("d");
    clickPin("e");
    expect(paths().map((edge) => edge.nodes)).toEqual([
      ["a", "b"],
      ["d", "e"],
    ]);
    expect(paths().map((edge) => edge.step)).toEqual([1, 2]);
  });
});
