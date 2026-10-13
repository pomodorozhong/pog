import type { EdgeType, LayerId, MapNode, Point } from "../domain/types";
import { newId, type MapAction } from "./editing";

/**
 * The path being drawn: the pin it has reached, and the path itself once it
 * has two pins (null before that).
 */
export type Draft = { from: string; edge: string | null };

/**
 * Draw path mode: take the path being drawn on to `to`, as one undo step.
 * The first two pins make a path; each later pin extends it, so a whole line
 * is one path until Esc ends it. A pin on another layer starts a new path,
 * unless the path is a waygate.
 */
export function drawTo(
  draft: Draft | null,
  from: MapNode | undefined,
  to: MapNode,
  type: EdgeType,
): { action: MapAction | null; draft: Draft } {
  if (!draft || !from || (from.layer !== to.layer && type !== "waygate"))
    return { action: null, draft: { from: to.id, edge: null } };
  if (from.id === to.id) return { action: null, draft };
  if (draft.edge)
    return {
      action: { type: "extendEdge", id: draft.edge, node: to.id },
      draft: { from: to.id, edge: draft.edge },
    };
  const id = newId("path");
  return {
    action: {
      type: "addEdge",
      edge: { id, nodes: [from.id, to.id], type, note: "" },
    },
    draft: { from: to.id, edge: id },
  };
}

/** Draw path mode, on a click on empty map: drop a junction and draw to it. */
export function dropJunction(
  draft: Draft | null,
  from: MapNode | undefined,
  layer: LayerId,
  [x, y]: Point,
  type: EdgeType,
): { action: MapAction; draft: Draft } {
  const node: MapNode = {
    id: newId("junction"),
    layer,
    x,
    y,
    kind: "junction",
    label: "",
    ref: null,
  };
  const next = drawTo(draft, from, node, type);
  return {
    action: {
      type: "batch",
      actions: [
        { type: "addNode", node },
        ...(next.action ? [next.action] : []),
      ],
    },
    draft: next.draft,
  };
}
