import type { MapEdge } from "../src/domain/types";
import { newPath } from "../src/map/editing";

/** A path as drawn, before it has a step: the default look, in gold. */
export const drawn = (id: string, nodes: string[]): Omit<MapEdge, "step"> => ({
  ...newPath(id, nodes),
  color: "gold",
});
