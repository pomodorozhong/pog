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

/** A drawn path between two nodes. Only waygates may join different layers. */
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

export type MapDocument = {
  schemaVersion: 1;
  nodes: MapNode[];
  edges: MapEdge[];
};

export type MapView = { layer: LayerId; x: number; y: number; zoom: number };
export type PlayerDocument = {
  schemaVersion: 1;
  language: Language;
  view: MapView;
};

export type Documents = { map: MapDocument; player: PlayerDocument };
export type DocumentName = keyof Documents;
export const DOCUMENT_NAMES: DocumentName[] = ["map", "player"];
