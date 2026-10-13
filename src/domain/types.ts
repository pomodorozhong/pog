export type Language = "en" | "zh-TW";
export const LANGUAGES: Language[] = ["en", "zh-TW"];
export type Localized = Record<Language, string>;

export const LAYERS = [
  "overworld",
  "underground",
  "dlc",
  "dlc-underground",
] as const;
export type LayerId = (typeof LAYERS)[number];

export const NODE_KINDS = ["grace", "junction", "item", "entrance"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_TYPES = [
  "road",
  "torrent",
  "foot",
  "one-way-drop",
  "lift",
  "waygate",
  "spiritspring",
  "requires-key",
  "requires-flag",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export type Point = [x: number, y: number];

/** A place on the map, in native map pixels of its layer. */
export type MapNode = {
  id: string;
  layer: LayerId;
  x: number;
  y: number;
  kind: NodeKind;
  /** Player-written label, kept as written. */
  label: string;
  /** Catalog id (for example "place/76100" or "weapon/1000000"), or null. */
  ref: string | null;
};

/**
 * A drawn path between two nodes. Either end can be a game grace by its
 * catalog id ("grace/<row>"), which the map shows without storing. Only
 * waygates may join different layers.
 */
export type MapEdge = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  /** Waypoints between the two nodes, on the nodes' layer. */
  points: Point[];
  /** Player-written note, such as the key or boss a requirement needs. */
  note: string;
};

/** A profile's own nodes and paths. Game graces are not stored here. */
export type MapDocument = {
  schemaVersion: 2;
  nodes: MapNode[];
  edges: MapEdge[];
};

export type MapView = { layer: LayerId; x: number; y: number; zoom: number };
export const WISHLIST_STATUSES = ["needed", "acquired", "skipped"] as const;
export type WishlistStatus = (typeof WISHLIST_STATUSES)[number];

/** An item the player wants in this playthrough. */
export type WishlistItem = {
  /** Catalog id of the item, such as "weapon/1000000". Unique within a wishlist. */
  item: string;
  status: WishlistStatus;
  /** Player-written, kept as written. */
  note: string;
};

/** How far the player has got in this playthrough. */
export type Progress = {
  /**
   * Game event flags known to be set: graces discovered (each catalog grace
   * has its flag), and later items picked up and bosses beaten. Sorted.
   */
  flags: number[];
  /** The node on this profile's map where the player is, or null. */
  position: string | null;
};

/** Constraints routing follows. The free-text constraints stay as a note beside them. */
export type RouteRules = {
  /** Path types this playthrough doesn't use, such as "torrent". */
  avoid: EdgeType[];
  /** Whether Shadow of the Erdtree is part of this playthrough. */
  dlc: boolean;
};

/** The game save character a playthrough imports its progress from. */
export type SaveLink = {
  steamId: string;
  /** 0–9. */
  slot: number;
  /** The character's name when linked, to notice a slot reused by another character. */
  name: string;
};

/**
 * One whole route: a playthrough with its own goal, constraints, wishlist,
 * progress and linked save slot. Its map (nodes and paths) is a separate
 * document, `maps/<id>`.
 */
export type Profile = {
  /** Lowercase letters, digits and dashes, since it names the profile's map file. */
  id: string;
  /** Player-written, kept as written. Empty shows as "Untitled playthrough". */
  name: string;
  goal: string;
  constraints: string;
  rules: RouteRules;
  wishlist: WishlistItem[];
  progress: Progress;
  save: SaveLink | null;
};

export type PlayerDocument = {
  schemaVersion: 6;
  language: Language;
  view: MapView;
  activeProfile: string;
  profiles: Profile[];
};

export type Documents = { map: MapDocument; player: PlayerDocument };
export type DocumentName = keyof Documents;
/** Where a document is saved: `player`, or `maps/<profile id>` for a profile's map. */
export type DocumentKey = "player" | `maps/${string}`;
