import type {
  EdgeType,
  MapDocument,
  MapEdge,
  MapNode,
  Point,
} from "../domain/types";

export const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** A path to add: it always becomes the last step. */
export type NewEdge = Omit<MapEdge, "step">;

export type MapAction =
  | { type: "addNode"; node: MapNode }
  | { type: "updateNode"; id: string; changes: Partial<Omit<MapNode, "id">> }
  | { type: "removeNode"; id: string }
  | { type: "addEdge"; edge: NewEdge }
  | {
      type: "updateEdge";
      id: string;
      changes: Partial<Pick<MapEdge, "type" | "note" | "points">>;
    }
  | { type: "removeEdge"; id: string }
  /** Give a path another step; the paths in between shift by one. */
  | { type: "moveEdge"; id: string; step: number }
  /** Several edits as one undo step. */
  | { type: "batch"; actions: MapAction[] };

/** Nodes a path can end at without being stored in the document: the game graces. */
export type FixedNodes = ReadonlyMap<string, MapNode>;
const NO_FIXED_NODES: FixedNodes = new Map();

/**
 * Apply one edit. Returns the same document when the edit would make it invalid.
 * Fixed nodes can be path ends, but can't be moved or removed.
 */
export function applyMapAction(
  doc: MapDocument,
  action: MapAction,
  fixed: FixedNodes = NO_FIXED_NODES,
): MapDocument {
  const find = (id: string) =>
    doc.nodes.find((n) => n.id === id) ?? fixed.get(id);
  switch (action.type) {
    case "addNode":
      return { ...doc, nodes: [...doc.nodes, action.node] };
    case "updateNode": {
      const node = doc.nodes.find((n) => n.id === action.id);
      if (!node) return doc;
      const updated = { ...node, ...action.changes };
      // Moving a node to another layer would strand its non-waygate paths.
      if (
        updated.layer !== node.layer &&
        doc.edges.some((e) => touches(e, node.id) && e.type !== "waygate")
      )
        return doc;
      return {
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === action.id ? updated : n)),
      };
    }
    case "removeNode":
      if (!doc.nodes.some((n) => n.id === action.id)) return doc;
      return {
        ...doc,
        nodes: doc.nodes.filter((n) => n.id !== action.id),
        edges: renumber(
          inStepOrder(doc.edges).filter((e) => !touches(e, action.id)),
        ),
      };
    case "addEdge": {
      const { edge } = action;
      const from = find(edge.from);
      const to = find(edge.to);
      if (!from || !to || from.id === to.id) return doc;
      if (from.layer !== to.layer && edge.type !== "waygate") return doc;
      return {
        ...doc,
        edges: [
          ...doc.edges,
          {
            ...edge,
            points: from.layer === to.layer ? edge.points : [],
            step: doc.edges.length + 1,
          },
        ],
      };
    }
    case "updateEdge": {
      const edge = doc.edges.find((e) => e.id === action.id);
      if (!edge) return doc;
      const updated = { ...edge, ...action.changes };
      const layers = new Set(
        [find(edge.from), find(edge.to)].map((n) => n?.layer).filter(Boolean),
      );
      if (layers.size > 1 && updated.type !== "waygate") return doc;
      return {
        ...doc,
        edges: doc.edges.map((e) => (e.id === action.id ? updated : e)),
      };
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
    case "batch":
      return action.actions.reduce(
        (next, each) => applyMapAction(next, each, fixed),
        doc,
      );
  }
}

const touches = (edge: MapEdge, nodeId: string) =>
  edge.from === nodeId || edge.to === nodeId;

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

/** Edges that can only be travelled from `from` to `to`. */
export const isOneWay = (type: EdgeType) => type === "one-way-drop";

export const edgeLine = (
  edge: MapEdge,
  from: MapNode,
  to: MapNode,
): Point[] => [[from.x, from.y], ...edge.points, [to.x, to.y]];
