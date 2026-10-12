import {
  EDGE_TYPES,
  LANGUAGES,
  LAYERS,
  NODE_KINDS,
  type DocumentName,
  type Documents,
  type MapDocument,
  type PlayerDocument,
} from "../domain/types.ts";

function hasExactKeys(
  value: unknown,
  required: string[],
  optional: string[] = [],
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

const isCoordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);
const includes = <T>(list: readonly T[], value: unknown) =>
  list.includes(value as T);

function checkMap(value: unknown): value is MapDocument {
  if (!hasExactKeys(value, ["schemaVersion", "nodes", "edges"])) return false;
  const v = value as MapDocument;
  if (
    v.schemaVersion !== 1 ||
    !Array.isArray(v.nodes) ||
    !Array.isArray(v.edges)
  )
    return false;
  const layerOf = new Map<string, string>();
  for (const n of v.nodes) {
    if (
      !hasExactKeys(n, ["id", "layer", "x", "y", "kind", "label", "ref"]) ||
      typeof n.id !== "string" ||
      layerOf.has(n.id) ||
      !includes(LAYERS, n.layer) ||
      !isCoordinate(n.x) ||
      !isCoordinate(n.y) ||
      !includes(NODE_KINDS, n.kind) ||
      typeof n.label !== "string" ||
      !(n.ref === null || typeof n.ref === "string")
    )
      return false;
    layerOf.set(n.id, n.layer);
  }
  const edgeIds = new Set<string>();
  return v.edges.every((e) => {
    const ok =
      hasExactKeys(e, ["id", "from", "to", "type", "points", "note"]) &&
      typeof e.id === "string" &&
      !edgeIds.has(e.id) &&
      layerOf.has(e.from) &&
      layerOf.has(e.to) &&
      e.from !== e.to &&
      includes(EDGE_TYPES, e.type) &&
      (layerOf.get(e.from) === layerOf.get(e.to) || e.type === "waygate") &&
      Array.isArray(e.points) &&
      e.points.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every(isCoordinate),
      ) &&
      typeof e.note === "string";
    edgeIds.add(e.id);
    return ok;
  });
}

function checkPlayer(value: unknown): value is PlayerDocument {
  if (!hasExactKeys(value, ["schemaVersion", "language", "view"])) return false;
  const v = value as PlayerDocument;
  return (
    v.schemaVersion === 1 &&
    includes(LANGUAGES, v.language) &&
    hasExactKeys(v.view, ["layer", "x", "y", "zoom"]) &&
    includes(LAYERS, v.view.layer) &&
    [v.view.x, v.view.y, v.view.zoom].every(isCoordinate)
  );
}

const checks: {
  [N in DocumentName]: (value: unknown) => value is Documents[N];
} = {
  map: checkMap,
  player: checkPlayer,
};

export function validDocument<N extends DocumentName>(
  name: N,
  value: unknown,
): value is Documents[N] {
  try {
    return checks[name](value);
  } catch {
    return false;
  }
}

export const initialDocuments = (): Documents => ({
  map: { schemaVersion: 1, nodes: [], edges: [] },
  player: {
    schemaVersion: 1,
    language: "en",
    view: { layer: "overworld", x: 5248, y: 5248, zoom: 3 },
  },
});
