import {
  EDGE_TYPES,
  LANGUAGES,
  LAYERS,
  NODE_KINDS,
  WISHLIST_STATUSES,
  type DocumentKey,
  type DocumentName,
  type Documents,
  type MapDocument,
  type PlayerDocument,
  type Progress,
  type RouteRules,
  type SaveLink,
  type WishlistItem,
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

/** A game grace's catalog id, which paths use to end at it. */
const GRACE_ID = /^grace\/\d+$/;

function checkMap(value: unknown): value is MapDocument {
  if (!hasExactKeys(value, ["schemaVersion", "nodes", "edges"])) return false;
  const v = value as MapDocument;
  if (
    v.schemaVersion !== MAP_VERSION ||
    !Array.isArray(v.nodes) ||
    !Array.isArray(v.edges)
  )
    return false;
  const layerOf = new Map<string, string>();
  for (const n of v.nodes) {
    if (
      !hasExactKeys(n, ["id", "layer", "x", "y", "kind", "label", "ref"]) ||
      typeof n.id !== "string" ||
      GRACE_ID.test(n.id) ||
      // Graces are game data, shown on every map; a map stores none.
      n.kind === "grace" ||
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
  const steps = new Set<number>();
  const end = (id: unknown) =>
    typeof id === "string" && (layerOf.has(id) || GRACE_ID.test(id));
  return v.edges.every((e) => {
    // A game grace's layer is game data, so only paths between two of the
    // profile's own nodes are checked for joining layers here.
    const joinsLayers =
      layerOf.has(e.from) &&
      layerOf.has(e.to) &&
      layerOf.get(e.from) !== layerOf.get(e.to);
    const ok =
      hasExactKeys(e, ["id", "from", "to", "type", "points", "note", "step"]) &&
      typeof e.id === "string" &&
      !edgeIds.has(e.id) &&
      end(e.from) &&
      end(e.to) &&
      e.from !== e.to &&
      includes(EDGE_TYPES, e.type) &&
      (!joinsLayers || e.type === "waygate") &&
      Array.isArray(e.points) &&
      e.points.every(
        (p) => Array.isArray(p) && p.length === 2 && p.every(isCoordinate),
      ) &&
      typeof e.note === "string" &&
      // Steps run 1..N with no gaps or repeats.
      Number.isInteger(e.step) &&
      e.step >= 1 &&
      e.step <= v.edges.length &&
      !steps.has(e.step);
    edgeIds.add(e.id);
    steps.add(e.step);
    return ok;
  });
}

function checkWishlist(value: unknown): value is WishlistItem[] {
  if (!Array.isArray(value)) return false;
  const items = new Set<string>();
  return value.every((w) => {
    const ok =
      hasExactKeys(w, ["item", "status", "note"]) &&
      typeof w.item === "string" &&
      !items.has(w.item) &&
      includes(WISHLIST_STATUSES, w.status) &&
      typeof w.note === "string";
    items.add(w.item);
    return ok;
  });
}

function checkProgress(value: unknown): value is Progress {
  if (!hasExactKeys(value, ["flags", "position"])) return false;
  const v = value as Progress;
  return (
    Array.isArray(v.flags) &&
    v.flags.every(
      (flag, i) =>
        Number.isSafeInteger(flag) &&
        flag >= 0 &&
        (i === 0 || flag > v.flags[i - 1]),
    ) &&
    (v.position === null || typeof v.position === "string")
  );
}

function checkRules(value: unknown): value is RouteRules {
  if (!hasExactKeys(value, ["avoid", "dlc"])) return false;
  const v = value as RouteRules;
  return (
    Array.isArray(v.avoid) &&
    v.avoid.every(
      (t, i) => includes(EDGE_TYPES, t) && v.avoid.indexOf(t) === i,
    ) &&
    typeof v.dlc === "boolean"
  );
}

function checkSaveLink(value: unknown): value is SaveLink | null {
  if (value === null) return true;
  if (!hasExactKeys(value, ["steamId", "slot", "name"])) return false;
  const v = value as SaveLink;
  return (
    typeof v.steamId === "string" &&
    /^\d{1,20}$/.test(v.steamId) &&
    Number.isInteger(v.slot) &&
    v.slot >= 0 &&
    v.slot < 10 &&
    typeof v.name === "string"
  );
}

function checkPlayer(value: unknown): value is PlayerDocument {
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "language",
      "view",
      "activeProfile",
      "profiles",
    ])
  )
    return false;
  const v = value as PlayerDocument;
  const ids = new Set<string>();
  return (
    v.schemaVersion === 6 &&
    includes(LANGUAGES, v.language) &&
    hasExactKeys(v.view, ["layer", "x", "y", "zoom"]) &&
    includes(LAYERS, v.view.layer) &&
    [v.view.x, v.view.y, v.view.zoom].every(isCoordinate) &&
    Array.isArray(v.profiles) &&
    v.profiles.length > 0 &&
    v.profiles.every((p) => {
      const ok =
        hasExactKeys(p, [
          "id",
          "name",
          "goal",
          "constraints",
          "rules",
          "wishlist",
          "progress",
          "save",
        ]) &&
        typeof p.id === "string" &&
        PROFILE_ID.test(p.id) &&
        !ids.has(p.id) &&
        [p.name, p.goal, p.constraints].every((t) => typeof t === "string") &&
        checkRules(p.rules) &&
        checkWishlist(p.wishlist) &&
        checkProgress(p.progress) &&
        checkSaveLink(p.save);
      ids.add(p.id);
      return ok;
    }) &&
    ids.has(v.activeProfile)
  );
}

export const FIRST_PROFILE_ID = "profile-1";
const PLAYER_VERSION = 6;
const MAP_VERSION = 2;
const PROFILE_ID = /^[a-z0-9-]{1,64}$/;

export const mapKey = (profile: string): DocumentKey => `maps/${profile}`;

/** Which document a storage key holds, or null for anything else. */
export function documentNameOf(key: string): DocumentName | null {
  if (key === "player") return "player";
  const match = /^maps\/(.+)$/.exec(key);
  return match && PROFILE_ID.test(match[1]) ? "map" : null;
}
const firstProfile = () => ({
  id: FIRST_PROFILE_ID,
  name: "",
  goal: "",
  constraints: "",
  rules: { avoid: [], dlc: true },
  wishlist: [],
  progress: { flags: [], position: null },
  save: null,
});

/**
 * Bring a document saved by an older version up to the current schema.
 * Anything unrecognised is returned unchanged, so validation rejects it.
 */
export function upgradeDocument(name: DocumentName, value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (name === "map") return upgradeMap(value);
  let v = value as { schemaVersion: unknown; profiles?: unknown };
  if (
    v.schemaVersion === 1 &&
    hasExactKeys(v, ["schemaVersion", "language", "view"])
  )
    // Version 1 had no profiles: everything so far becomes the first playthrough.
    return {
      ...v,
      schemaVersion: PLAYER_VERSION,
      activeProfile: FIRST_PROFILE_ID,
      profiles: [firstProfile()],
    };
  if (
    typeof v.schemaVersion === "number" &&
    v.schemaVersion >= 2 &&
    v.schemaVersion < PLAYER_VERSION &&
    Array.isArray(v.profiles)
  ) {
    // Later versions added the wishlist (3), progress (4), save link (5) and
    // routing rules (6).
    const added = firstProfile();
    v = {
      ...v,
      schemaVersion: PLAYER_VERSION,
      profiles: v.profiles.map((p: unknown) =>
        p && typeof p === "object"
          ? {
              ...p,
              rules: "rules" in p ? p.rules : added.rules,
              wishlist: "wishlist" in p ? p.wishlist : added.wishlist,
              progress: "progress" in p ? p.progress : added.progress,
              save: "save" in p ? p.save : added.save,
            }
          : p,
      ),
    };
  }
  return v;
}

function upgradeMap(value: object): unknown {
  const v = value as { schemaVersion: unknown; edges?: unknown };
  // Version 2 numbered the paths; version 1 paths are numbered in file order.
  if (v.schemaVersion === 1 && Array.isArray(v.edges))
    return {
      ...v,
      schemaVersion: MAP_VERSION,
      edges: v.edges.map((e: unknown, i) =>
        e && typeof e === "object" ? { ...e, step: i + 1 } : e,
      ),
    };
  return v;
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
  map: { schemaVersion: MAP_VERSION, nodes: [], edges: [] },
  player: {
    schemaVersion: PLAYER_VERSION,
    language: "en",
    view: { layer: "overworld", x: 5248, y: 5248, zoom: 3 },
    activeProfile: FIRST_PROFILE_ID,
    profiles: [firstProfile()],
  },
});
