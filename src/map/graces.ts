import type { MapDocument, MapEdge, MapNode } from "../domain/types";
import type { CatalogGrace } from "./catalog";
import type { MapAction } from "./editing";

/**
 * Game graces are game data, like the map tiles: every profile's map shows
 * them without storing them. Their catalog id ("grace/<row>") is also their
 * node id, so a drawn path can end at one.
 */
export const isGameGrace = (id: string) => id.startsWith("grace/");

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The game's graces as map nodes. Graces that share a name and spot with an
 * earlier one (Leyndell and its ashen twin) are left out, so one marker shows.
 */
export function gameGraceNodes(graces: CatalogGrace[]): MapNode[] {
  const nodes: MapNode[] = [];
  const kept: CatalogGrace[] = [];
  for (const grace of graces) {
    const twin = kept.some(
      (g) =>
        g.layer === grace.layer &&
        g.name.en === grace.name.en &&
        distance(g, grace) <= 4,
    );
    if (twin) continue;
    kept.push(grace);
    nodes.push({
      id: grace.id,
      layer: grace.layer,
      x: grace.x,
      y: grace.y,
      kind: "grace",
      label: "",
      ref: grace.id,
    });
  }
  return nodes;
}

/** A profile's map with the game graces it shows but doesn't store. */
export const withGameGraces = (
  doc: MapDocument,
  graces: MapNode[],
): MapDocument => ({ ...doc, nodes: [...graces, ...doc.nodes] });

/**
 * The edits that replace a hand-placed grace with a game grace, as one batch:
 * the node goes, and its paths end at the game grace instead.
 */
export function replaceWithGrace(
  doc: MapDocument,
  nodeId: string,
  graceId: string,
): MapAction {
  const rewired = doc.edges
    .filter((e) => e.from === nodeId || e.to === nodeId)
    .map((e): MapEdge => ({
      ...e,
      from: e.from === nodeId ? graceId : e.from,
      to: e.to === nodeId ? graceId : e.to,
    }))
    .filter((e) => e.from !== e.to);
  return {
    type: "batch",
    actions: [
      { type: "removeNode", id: nodeId },
      ...rewired.map((edge): MapAction => ({ type: "addEdge", edge })),
    ],
  };
}
