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
 * The graces that show on the map, and the twins hidden behind them. A grace
 * that shares a name and spot with an earlier one (Leyndell, Royal Capital
 * and its Ashen Capital twin) is hidden, so one marker shows. Twins have
 * separate "discovered" flags.
 */
export function graceTwins(graces: CatalogGrace[]) {
  const shown: CatalogGrace[] = [];
  const twins = new Map<string, CatalogGrace[]>();
  for (const grace of graces) {
    const twin = shown.find(
      (g) =>
        g.layer === grace.layer &&
        g.name.en === grace.name.en &&
        distance(g, grace) <= 4,
    );
    if (twin) twins.set(twin.id, [...(twins.get(twin.id) ?? []), grace]);
    else shown.push(grace);
  }
  return { shown, twins };
}

/** The game's graces as map nodes, without the twins hidden behind them. */
export function gameGraceNodes(graces: CatalogGrace[]): MapNode[] {
  const nodes: MapNode[] = [];
  for (const grace of graceTwins(graces).shown) {
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
  const { label, place, items, bosses }: GraceDetails = {
    ...doc.graces?.[id],
    ...Object.fromEntries(given),
  };
  const details: GraceDetails = {
    ...(label ? { label } : {}),
    ...(place ? { place } : {}),
    ...(items?.length ? { items } : {}),
    ...(bosses?.length ? { bosses } : {}),
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
