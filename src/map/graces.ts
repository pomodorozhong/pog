import type { GraceDetails, MapDocument, MapNode } from "../domain/types";
import type { CatalogGrace } from "./catalog";

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

/**
 * A profile's map with the game graces it shows but doesn't store, each with
 * what the player added to it.
 */
export const withGameGraces = (
  doc: MapDocument,
  graces: MapNode[],
): MapDocument => ({
  ...doc,
  nodes: [
    ...graces.map((g) => ({ ...g, ...doc.graces?.[g.id] })),
    ...doc.nodes,
  ],
});

/**
 * The map with a game grace's details changed. A field left undefined stays
 * as it was; an empty one is cleared. Cleared fields aren't kept, nor is a
 * grace left with nothing added.
 */
export function updateGrace(
  doc: MapDocument,
  id: string,
  changes: GraceDetails,
): MapDocument {
  const given = Object.entries(changes).filter(([, v]) => v !== undefined);
  if (!given.length) return doc;
  const { label, place, items }: GraceDetails = {
    ...doc.graces?.[id],
    ...Object.fromEntries(given),
  };
  const details: GraceDetails = {
    ...(label ? { label } : {}),
    ...(place ? { place } : {}),
    ...(items?.length ? { items } : {}),
  };
  const graces = Object.fromEntries(
    Object.entries({ ...doc.graces, [id]: details }).filter(
      ([, g]) => Object.keys(g).length,
    ),
  );
  const next: MapDocument = { ...doc, graces };
  if (!Object.keys(graces).length) delete next.graces;
  return next;
}
