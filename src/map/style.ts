import type { EdgeType, NodeKind } from "../domain/types";

export const EDGE_STYLE: Record<
  EdgeType,
  { color: string; dashArray?: string; weight: number }
> = {
  road: { color: "#d8b36b", weight: 4 },
  torrent: { color: "#a6c69b", weight: 4 },
  foot: { color: "#eee9db", dashArray: "6 6", weight: 3 },
  "one-way-drop": { color: "#e07a5f", dashArray: "8 6", weight: 3 },
  lift: { color: "#7fb7d9", weight: 4 },
  waygate: { color: "#b48ce0", dashArray: "4 6", weight: 3 },
  spiritspring: { color: "#6fd1c4", weight: 4 },
  "requires-key": { color: "#e0b84d", dashArray: "2 6", weight: 4 },
  "requires-flag": { color: "#e05f8a", dashArray: "2 6", weight: 4 },
};

export const NODE_SYMBOL: Record<NodeKind, string> = {
  grace: "✦",
  junction: "",
  item: "◆",
  entrance: "▣",
};
