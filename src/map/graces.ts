import type { LayerId, MapDocument, MapNode } from "../domain/types";
import type { CatalogGrace } from "./catalog";
import { newId, type MapAction } from "./editing";

/** How close (in map pixels) a hand-placed grace must be to be taken as a game grace. */
export const LINK_RADIUS = 48;

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const isGraceRef = (ref: string | null) => ref?.startsWith("grace/") ?? false;

/** Game graces on a layer that no node links to yet. */
export function missingGraces(
  graces: CatalogGrace[],
  doc: MapDocument,
  layer: LayerId,
): CatalogGrace[] {
  const linked = new Set(doc.nodes.map((n) => n.ref));
  return graces.filter((g) => g.layer === layer && !linked.has(g.id));
}

/**
 * The edits that bring a layer's graces onto the map, as one batch.
 *
 * Grace nodes the player placed by hand (unlinked, or linked to a place name)
 * are linked to the nearest game grace and keep their position. Graces that
 * share a name and spot with one already on the map (Leyndell and its ashen
 * twin) are left out.
 */
export function importGraces(
  graces: CatalogGrace[],
  doc: MapDocument,
  layer: LayerId,
): MapAction {
  const missing = missingGraces(graces, doc, layer);
  const actions: MapAction[] = [];
  const taken = new Set<string>();

  const handPlaced = doc.nodes.filter(
    (n) => n.layer === layer && n.kind === "grace" && !isGraceRef(n.ref),
  );
  const pairs = handPlaced
    .flatMap((node) =>
      missing.map((grace) => ({ node, grace, d: distance(node, grace) })),
    )
    .filter((p) => p.d <= LINK_RADIUS)
    .sort((a, b) => a.d - b.d);
  const linkedNodes = new Set<string>();
  for (const { node, grace } of pairs) {
    if (linkedNodes.has(node.id) || taken.has(grace.id)) continue;
    linkedNodes.add(node.id);
    taken.add(grace.id);
    actions.push({
      type: "updateNode",
      id: node.id,
      changes: { ref: grace.id },
    });
  }

  const placed: { name: string; x: number; y: number }[] = [];
  const byId = new Map(graces.map((g) => [g.id, g]));
  for (const node of doc.nodes) {
    const grace = node.ref ? byId.get(node.ref) : undefined;
    if (grace) placed.push({ name: grace.name.en, x: grace.x, y: grace.y });
  }
  for (const grace of missing) {
    if (taken.has(grace.id)) {
      placed.push({ name: grace.name.en, x: grace.x, y: grace.y });
      continue;
    }
    if (placed.some((p) => p.name === grace.name.en && distance(p, grace) <= 4))
      continue;
    placed.push({ name: grace.name.en, x: grace.x, y: grace.y });
    const node: MapNode = {
      id: newId("grace"),
      layer,
      x: grace.x,
      y: grace.y,
      kind: "grace",
      label: "",
      ref: grace.id,
    };
    actions.push({ type: "addNode", node });
  }
  return { type: "batch", actions };
}
