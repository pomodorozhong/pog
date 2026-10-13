import type { EdgeType, LayerId, MapNode, Point } from "../domain/types";
import { newId, type MapAction } from "./editing";

/**
 * Draw path mode, on a click on empty map: drop a junction there and end the
 * path being drawn at it, as one undo step. Drawing goes on from the new
 * junction, so a route is laid down one click at a time.
 *
 * Only a waygate continues from a node on another layer; otherwise the new
 * junction starts a fresh path.
 */
export function dropJunction(
  from: MapNode | undefined,
  layer: LayerId,
  [x, y]: Point,
  type: EdgeType,
): { action: MapAction; next: string } {
  const node: MapNode = {
    id: newId("junction"),
    layer,
    x,
    y,
    kind: "junction",
    label: "",
    ref: null,
  };
  const addNode: MapAction = { type: "addNode", node };
  if (!from || (from.layer !== layer && type !== "waygate"))
    return { action: addNode, next: node.id };
  return {
    action: {
      type: "batch",
      actions: [addNode, pathAction(from.id, node.id, type)],
    },
    next: node.id,
  };
}

/** The edit that draws a straight path between two nodes. */
export const pathAction = (
  from: string,
  to: string,
  type: EdgeType,
): MapAction => ({
  type: "addEdge",
  edge: { id: newId("edge"), from, to, type, points: [], note: "" },
});
