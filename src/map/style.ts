import type { MapEdge, NodeKind, PathColor, PathLine } from "../domain/types";

export const PATH_COLOR: Record<PathColor, string> = {
  gold: "#d8b36b",
  green: "#a6c69b",
  white: "#eee9db",
  red: "#e07a5f",
  blue: "#7fb7d9",
  purple: "#b48ce0",
  teal: "#6fd1c4",
  pink: "#e05f8a",
};

const LINE_STYLE: Record<PathLine, { dashArray?: string; weight: number }> = {
  solid: { weight: 4 },
  dashed: { dashArray: "6 6", weight: 3 },
};

/** How a path is drawn on the map. */
export const pathStyle = (edge: Pick<MapEdge, "color" | "line">) => ({
  color: PATH_COLOR[edge.color],
  ...LINE_STYLE[edge.line],
});

export const NODE_SYMBOL: Record<NodeKind, string> = {
  grace: "✦",
  junction: "",
  item: "◆",
  entrance: "▣",
};

/** Marks a pin where bosses are fought. */
export const BOSS_SYMBOL = "☠";
