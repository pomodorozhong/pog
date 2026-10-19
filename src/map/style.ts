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

/** A chevron along a path, pointing right before it's turned the path's way. */
export const ARROW_SYMBOL =
  '<svg viewBox="0 0 10 10" aria-hidden="true">' +
  '<path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Marks a pin where bosses are fought: a skull, drawn rather than a text
 * glyph so it's symmetric and the same in every font. The eyes, nose and
 * teeth are cut out of it, so they show the marker's background.
 */
export const BOSS_SYMBOL =
  '<svg class="boss-icon" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path fill="currentColor" fill-rule="evenodd" d="' +
  // Cranium and jaw.
  "M8 1.25C4.3 1.25 1.75 3.9 1.75 7.3c0 2.05 1 3.5 2.6 4.25v2.05c0 .6.45 1.15 1.15 1.15h5c.7 0 1.15-.55 1.15-1.15v-2.05c1.6-.75 2.6-2.2 2.6-4.25C14.25 3.9 11.7 1.25 8 1.25Z" +
  // Eyes.
  "M3.9 7.6a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0-3.5 0Z" +
  "M8.6 7.6a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0-3.5 0Z" +
  // Nose.
  "M8 9.7l-1 1.6h2Z" +
  // Gaps between the teeth.
  "M6.55 12.9h.7v1.85h-.7Z" +
  "M8.75 12.9h.7v1.85h-.7Z" +
  '"/></svg>';
