import type { LayerId, NodeKind, PathColor } from "../domain/types";

// English interface text; translated through data/localization/ui.zh-TW.json.
export const LAYER_NAMES: Record<LayerId, string> = {
  overworld: "Lands Between",
  underground: "Lands Between · Underground",
  dlc: "Realm of Shadow",
  "dlc-underground": "Realm of Shadow · Underground",
};

export const PATH_COLOR_NAMES: Record<PathColor, string> = {
  gold: "Gold",
  green: "Green",
  white: "White",
  red: "Red",
  blue: "Blue",
  purple: "Purple",
  teal: "Teal",
  pink: "Pink",
};

export const NODE_KIND_NAMES: Record<NodeKind, string> = {
  grace: "Grace",
  junction: "Junction",
  item: "Item pin",
  entrance: "Entrance",
};
