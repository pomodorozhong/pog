import type { EdgeType, LayerId, NodeKind } from "../domain/types";

// English interface text; translated through data/localization/ui.zh-TW.json.
export const LAYER_NAMES: Record<LayerId, string> = {
  overworld: "Lands Between",
  underground: "Lands Between · Underground",
  dlc: "Realm of Shadow",
  "dlc-underground": "Realm of Shadow · Underground",
};

export const EDGE_NAMES: Record<EdgeType, string> = {
  road: "Road",
  torrent: "Torrent",
  foot: "On foot",
  "one-way-drop": "One-way drop",
  lift: "Lift",
  waygate: "Waygate",
  spiritspring: "Spiritspring",
  "requires-key": "Needs a key",
  "requires-flag": "Needs progress",
};

export const NODE_KIND_NAMES: Record<NodeKind, string> = {
  grace: "Grace",
  junction: "Junction",
  item: "Item pin",
  entrance: "Entrance",
};
