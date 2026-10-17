import {
  PATH_COLORS,
  type LayerId,
  type MapDocument,
  type MapEdge,
  type MapNode,
  type Point,
} from "../domain/types";

export const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/**
 * A path to add: it always becomes the last step. Without a color, it takes
 * its step's color.
 */
export type NewEdge = Omit<MapEdge, "step" | "color"> &
  Partial<Pick<MapEdge, "color">>;

/** A new path through `nodes`, drawn the default way. */
export const newPath = (id: string, nodes: string[]): NewEdge => ({
  id,
  nodes,
  line: "solid",
  oneWay: false,
  note: "",
  showNote: false,
});

/** A new path's color: the colors in turn, so neighbouring steps differ. */
export const stepColor = (step: number) =>
  PATH_COLORS[(step - 1) % PATH_COLORS.length];

/** What the path editor can change. */
export type EdgeChanges = Partial<
  Pick<MapEdge, "color" | "line" | "oneWay" | "note" | "showNote">
>;

export type MapAction =
  | { type: "addNode"; node: MapNode }
  | { type: "updateNode"; id: string; changes: Partial<Omit<MapNode, "id">> }
  | { type: "removeNode"; id: string }
  | { type: "addEdge"; edge: NewEdge }
  /** Continue a path from its last pin to another. */
  | { type: "extendEdge"; id: string; node: string }
  | {
      type: "updateEdge";
      id: string;
      changes: EdgeChanges;
    }
  | { type: "removeEdge"; id: string }
  /** Give a path another step; the paths in between shift by one. */
  | { type: "moveEdge"; id: string; step: number }
  /**
   * Split a path in two at its pin `at` (an index, neither end). The second
   * part is a new path with the next step.
   */
  | { type: "splitEdge"; id: string; at: number; newId: string }
  /** Several edits as one undo step. */
  | { type: "batch"; actions: MapAction[] };

/** Nodes a path can end at without being stored in the document: the game graces. */
export type FixedNodes = ReadonlyMap<string, MapNode>;
const NO_FIXED_NODES: FixedNodes = new Map();

/**
 * Apply one edit. Returns the same document when the edit would make it invalid.
 * Fixed nodes can be on paths, but can't be moved or removed.
 */
export function applyMapAction(
  doc: MapDocument,
  action: MapAction,
  fixed: FixedNodes = NO_FIXED_NODES,
): MapDocument {
  const find = (id: string) =>
    doc.nodes.find((n) => n.id === id) ?? fixed.get(id);
  const fits = (pins: string[]) =>
    pins.length >= 2 && pins.every((id, i) => find(id) && id !== pins[i - 1]);
  const replace = (edge: MapEdge) => ({
    ...doc,
    edges: doc.edges.map((e) => (e.id === edge.id ? edge : e)),
  });
  switch (action.type) {
    case "addNode":
      return { ...doc, nodes: [...doc.nodes, action.node] };
    case "updateNode": {
      const node = doc.nodes.find((n) => n.id === action.id);
      if (!node) return doc;
      const updated = { ...node, ...action.changes };
      return {
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === action.id ? updated : n)),
      };
    }
    case "removeNode": {
      if (!doc.nodes.some((n) => n.id === action.id)) return doc;
      // Paths through the node close up around it; a path left with one pin goes.
      const edges = inStepOrder(doc.edges).flatMap((e) => {
        if (!e.nodes.includes(action.id)) return [e];
        const nodes = e.nodes
          .filter((id) => id !== action.id)
          .filter((id, i, kept) => id !== kept[i - 1]);
        return nodes.length >= 2 ? [{ ...e, nodes }] : [];
      });
      return {
        ...doc,
        nodes: doc.nodes.filter((n) => n.id !== action.id),
        edges: renumber(edges),
      };
    }
    case "addEdge": {
      const { edge } = action;
      if (!fits(edge.nodes)) return doc;
      const step = doc.edges.length + 1;
      return {
        ...doc,
        edges: [...doc.edges, { color: stepColor(step), ...edge, step }],
      };
    }
    case "extendEdge": {
      const edge = doc.edges.find((e) => e.id === action.id);
      if (!edge) return doc;
      const nodes = [...edge.nodes, action.node];
      return fits(nodes) ? replace({ ...edge, nodes }) : doc;
    }
    case "updateEdge": {
      const edge = doc.edges.find((e) => e.id === action.id);
      if (!edge) return doc;
      const updated = { ...edge, ...action.changes };
      return fits(updated.nodes) ? replace(updated) : doc;
    }
    case "removeEdge":
      if (!doc.edges.some((e) => e.id === action.id)) return doc;
      return {
        ...doc,
        edges: renumber(
          inStepOrder(doc.edges).filter((e) => e.id !== action.id),
        ),
      };
    case "moveEdge": {
      const edge = doc.edges.find((e) => e.id === action.id);
      const step = Math.min(Math.max(1, action.step), doc.edges.length);
      if (!edge || !Number.isInteger(step) || step === edge.step) return doc;
      const others = inStepOrder(doc.edges).filter((e) => e.id !== edge.id);
      others.splice(step - 1, 0, edge);
      return { ...doc, edges: renumber(others) };
    }
    case "splitEdge": {
      const edge = doc.edges.find((e) => e.id === action.id);
      const { at } = action;
      if (
        !edge ||
        !(at > 0 && at < edge.nodes.length - 1) ||
        doc.edges.some((e) => e.id === action.newId)
      )
        return doc;
      const ordered = inStepOrder(doc.edges);
      ordered.splice(
        ordered.indexOf(edge),
        1,
        { ...edge, nodes: edge.nodes.slice(0, at + 1) },
        { ...edge, id: action.newId, nodes: edge.nodes.slice(at) },
      );
      return { ...doc, edges: renumber(ordered) };
    }
    case "batch":
      return action.actions.reduce(
        (next, each) => applyMapAction(next, each, fixed),
        doc,
      );
  }
}

/** Paths in walking order. */
export const inStepOrder = (edges: MapEdge[]) =>
  [...edges].sort((a, b) => a.step - b.step);

/** Number paths 1..N in the order given. */
const renumber = (edges: MapEdge[]) =>
  edges.map((e, i) => (e.step === i + 1 ? e : { ...e, step: i + 1 }));

export type History = {
  past: MapDocument[];
  present: MapDocument;
  future: MapDocument[];
};
export type HistoryAction =
  | MapAction
  | { type: "undo" }
  | { type: "redo" }
  /** Open a saved map, optionally with the undo history it had before. */
  | { type: "load"; doc: MapDocument; history?: History };
const HISTORY_LIMIT = 200;

export function historyReducer(
  history: History,
  action: HistoryAction,
  fixed?: FixedNodes,
): History {
  switch (action.type) {
    case "load":
      return action.history ?? { past: [], present: action.doc, future: [] };
    case "undo":
      if (!history.past.length) return history;
      return {
        past: history.past.slice(0, -1),
        present: history.past[history.past.length - 1],
        future: [history.present, ...history.future],
      };
    case "redo":
      if (!history.future.length) return history;
      return {
        past: [...history.past, history.present],
        present: history.future[0],
        future: history.future.slice(1),
      };
    default: {
      const next = applyMapAction(history.present, action, fixed);
      if (next === history.present) return history;
      return {
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    }
  }
}

/**
 * The stretches of a path to draw on `layer`, as lines of map points. Jumps
 * between layers aren't drawn.
 */
export function edgeRuns(
  edge: MapEdge,
  nodes: ReadonlyMap<string, MapNode>,
  layer: LayerId,
): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const id of edge.nodes) {
    const node = nodes.get(id);
    if (node?.layer === layer) run.push([node.x, node.y]);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
