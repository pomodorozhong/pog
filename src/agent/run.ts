import type {
  MapDocument,
  MapNode,
  PlayerDocument,
  WishlistItem,
} from "../domain/types";
import {
  isItem,
  searchCatalog,
  type CatalogItem,
  type GameData,
} from "../map/catalog";
import { newId, type MapAction } from "../map/editing";
import { isGameGrace } from "../map/graces";
import { activeProfile } from "../profiles/profiles";
import {
  addToWishlist,
  combinedWishlist,
  updateWishlistItem,
} from "../wishlist/wishlist";

/**
 * A change an agent asked for, waiting for the player's review. Nothing
 * changes until the player applies it.
 */
export type Proposal = {
  id: string;
  /** The playthrough it was proposed for. */
  profile: string;
  item: string;
} & (
  | {
      kind: "add";
      note?: string;
      /** The game grace a new pin holding the item goes beside. */
      grace?: string;
    }
  | { kind: "note"; pin: string | null; note: string }
);
/** A proposal before it has an ID. */
type NewProposal = Proposal extends infer P
  ? P extends Proposal
    ? Omit<P, "id">
    : never
  : never;
export type ProposalOutcome = "applied" | "dismissed";

/** What the tools read: the app's state as it is shown. */
export type AgentState = {
  data: GameData;
  player: PlayerDocument;
  /** The active profile's map with the game graces. */
  map: MapDocument;
  proposals: Proposal[];
  outcomes: ReadonlyMap<string, ProposalOutcome>;
};

/** A call the agent should change: the message says why. */
export class AgentError extends Error {}

/** How far east of its grace a proposed pin goes, in map pixels: clear of the grace's icon. */
export const PIN_OFFSET = 40;

const fold = (text: string) => text.normalize("NFKC").trim().toLowerCase();

const nameOf = (data: GameData, id: string) => {
  const entry = data.byId.get(id);
  return entry ? { en: entry.name.en, "zh-TW": entry.name["zh-TW"] } : null;
};

function text(args: Record<string, unknown>, key: string, required = false) {
  const value = args[key];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string")
    throw new AgentError(`"${key}" must be a string.`);
  return value;
}

function catalogItem(data: GameData, id: string): CatalogItem {
  const entry = data.byId.get(id);
  if (!entry || !isItem(entry))
    throw new AgentError(
      `"${id}" is not an item ID. Find the item with search_items first.`,
    );
  return entry;
}

const shownGraces = (map: MapDocument) =>
  map.nodes.filter((n) => n.kind === "grace" && isGameGrace(n.id));

/** The game grace the agent named, by ID or official name in either language. */
function findGrace(state: AgentState, query: string): MapNode {
  const graces = shownGraces(state.map);
  if (isGameGrace(query.trim())) {
    const grace = graces.find((g) => g.id === query.trim());
    if (!grace) throw new AgentError(`"${query}" is not a grace on the map.`);
    return grace;
  }
  const q = fold(query);
  const matches = graces.filter((g) => {
    const name = state.data.byId.get(g.id)?.name;
    return name && (fold(name.en) === q || fold(name["zh-TW"]) === q);
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1)
    throw new AgentError(
      `Several graces are named "${query}". Give one of their IDs instead: ${matches
        .map((g) => `${g.id} (${g.layer})`)
        .join(", ")}.`,
    );
  const named = graces.flatMap((g) => {
    const entry = state.data.byId.get(g.id);
    return entry ? [entry] : [];
  });
  // A name with a word too many matches nothing whole, so try each word.
  const words = query.split(/\s+/).filter((w) => w.length > 2);
  const closest = [
    ...new Set(
      [query, ...words].flatMap((q) =>
        searchCatalog(named, q, 5).map((g) => g.name.en),
      ),
    ),
  ].slice(0, 5);
  throw new AgentError(
    `No Site of Grace is named "${query}".${closest.length ? ` Closest: ${closest.join(", ")}.` : ""}`,
  );
}

/** The game grace nearest a node on its layer. */
export function nearestGrace(map: MapDocument, node: MapNode) {
  let best: MapNode | undefined;
  let bestDistance = Infinity;
  for (const grace of shownGraces(map)) {
    if (grace.layer !== node.layer) continue;
    const d = Math.hypot(grace.x - node.x, grace.y - node.y);
    if (d < bestDistance) [best, bestDistance] = [grace, d];
  }
  return best;
}

/** What a pin is, in words an agent can pass on: a grace's name, a label, or where it is. */
function pinName(state: AgentState, id: string | undefined) {
  const node = id && state.map.nodes.find((n) => n.id === id);
  if (!node) return null;
  if (isGameGrace(node.id)) return nameOf(state.data, node.id)?.en ?? node.id;
  if (node.label) return node.label;
  const grace = nearestGrace(state.map, node);
  const name = grace && nameOf(state.data, grace.id)?.en;
  return name ? `a pin near ${name}` : "a pin";
}

/** The wishlist entries of the active profile for an item, as the app lists them. */
function entriesFor(state: AgentState, item: string): WishlistItem[] {
  const { pinned, unpinned } = combinedWishlist(
    state.map,
    activeProfile(state.player).wishlist,
  );
  return [...pinned, ...unpinned].filter((w) => w.item === item);
}

const samePin = (entry: WishlistItem, pin: string | null) =>
  (entry.pin ?? null) === pin;

function describeProposal(state: AgentState, p: Proposal) {
  return {
    id: p.id,
    kind: p.kind,
    item: p.item,
    name: nameOf(state.data, p.item),
    ...(p.kind === "add"
      ? {
          ...(p.grace && { near_grace: nameOf(state.data, p.grace)?.en }),
          ...(p.note !== undefined && { note: p.note }),
        }
      : { pin: p.pin, note: p.note }),
  };
}

/** A proposal like this one already waiting, so asking twice doesn't queue it twice. */
const waiting = (state: AgentState, p: NewProposal) =>
  state.proposals.find(
    (q) =>
      JSON.stringify({ ...q, id: undefined }) ===
      JSON.stringify({ ...p, id: undefined }),
  );

/**
 * Run a tool against the app's state. A write tool doesn't change anything:
 * it returns a proposal for the player to review.
 */
export function runTool(
  name: string,
  rawArgs: unknown,
  state: AgentState,
): { result: unknown; proposal?: Proposal } {
  const args =
    rawArgs && typeof rawArgs === "object"
      ? (rawArgs as Record<string, unknown>)
      : {};
  const profile = activeProfile(state.player);
  switch (name) {
    case "search_items": {
      const query = text(args, "query", true)!;
      const limit = Math.min(
        30,
        Math.max(1, Number.isInteger(args.limit) ? (args.limit as number) : 10),
      );
      return {
        result: searchCatalog(state.data.catalog.items, query, limit).map(
          (item) => ({
            id: item.id,
            name: nameOf(state.data, item.id),
            type: item.type,
            dlc: item.dlc,
          }),
        ),
      };
    }
    case "get_wishlist": {
      const { pinned, unpinned } = combinedWishlist(
        state.map,
        profile.wishlist,
      );
      const entry = (w: WishlistItem & { joined?: true }) => ({
        item: w.item,
        name: nameOf(state.data, w.item),
        pin: w.pin ?? null,
        pin_name: pinName(state, w.pin),
        status: w.status,
        note: w.note,
        // On a walked path but never saved: the player hasn't touched it.
        ...(w.joined && { from_walked_path: true }),
      });
      return {
        result: {
          playthrough: profile.name || "Untitled playthrough",
          attached_to_pins: pinned.map(entry),
          not_attached: unpinned.map((w) => ({ ...entry(w), pin_name: null })),
          proposals_waiting: state.proposals
            .filter((p) => p.profile === profile.id)
            .map((p) => describeProposal(state, p)),
        },
      };
    }
    case "add_to_wishlist": {
      const item = catalogItem(state.data, text(args, "item", true)!).id;
      const note = text(args, "note");
      const graceName = text(args, "near_grace");
      const grace =
        graceName === undefined ? undefined : findGrace(state, graceName).id;
      const proposal: NewProposal = {
        kind: "add",
        profile: profile.id,
        item,
        ...(note !== undefined && { note }),
        ...(grace !== undefined && { grace }),
      };
      return propose(state, proposal);
    }
    case "set_item_note": {
      const item = catalogItem(state.data, text(args, "item", true)!).id;
      const note = text(args, "note", true)!;
      if (args.pin !== undefined && args.pin !== null) text(args, "pin", true);
      const entries = entriesFor(state, item);
      if (!entries.length)
        throw new AgentError(
          "That item isn't on the wishlist. Use add_to_wishlist instead.",
        );
      let pin: string | null;
      if (args.pin !== undefined) {
        pin = args.pin as string | null;
        if (!entries.some((w) => samePin(w, pin)))
          throw new AgentError(
            `The item has no entry at that pin. Its pins: ${entries
              .map((w) => w.pin ?? "null")
              .join(", ")}.`,
          );
      } else if (entries.length > 1)
        throw new AgentError(
          `The item has entries at several pins; give one: ${entries
            .map(
              (w) =>
                `${w.pin ?? "null"} (${pinName(state, w.pin) ?? "not attached"})`,
            )
            .join(", ")}.`,
        );
      else pin = entries[0].pin ?? null;
      return propose(state, {
        kind: "note",
        profile: profile.id,
        item,
        pin,
        note,
      });
    }
    case "get_proposal_status": {
      const ids = args.ids;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string"))
        throw new AgentError('"ids" must be a list of proposal IDs.');
      return {
        result: ids.map((id) => ({
          id,
          status: state.proposals.some((p) => p.id === id)
            ? "waiting"
            : (state.outcomes.get(id) ?? "unknown"),
        })),
      };
    }
    default:
      throw new AgentError(`Unknown tool "${name}".`);
  }
}

function propose(state: AgentState, proposal: NewProposal) {
  const same = waiting(state, proposal);
  const queued = same ?? ({ ...proposal, id: newId("proposal") } as Proposal);
  return {
    result: {
      proposal: queued.id,
      status: "waiting for review",
      message: "The player reviews it in the app before anything changes.",
    },
    ...(!same && { proposal: queued }),
  };
}

/** Why a proposal can't be applied any more, or null when it can. */
export type ProposalProblem =
  "other-playthrough" | "already-listed" | "grace-gone" | "entry-gone";

/**
 * Apply a proposal: the player document to save, and the map edit adding its
 * pin, if any. A proposal that went out of date gives the reason instead.
 */
export function applyProposal(
  proposal: Proposal,
  player: PlayerDocument,
  map: MapDocument,
):
  | { player: PlayerDocument; action?: MapAction }
  | { problem: ProposalProblem } {
  if (proposal.profile !== player.activeProfile)
    return { problem: "other-playthrough" };
  const profile = activeProfile(player);
  const { item } = proposal;
  if (proposal.kind === "note") {
    const exists = [
      ...combinedWishlist(map, profile.wishlist).pinned,
      ...profile.wishlist,
    ].some((w) => w.item === item && samePin(w, proposal.pin));
    if (!exists) return { problem: "entry-gone" };
    return {
      player: updateWishlistItem(player, profile.id, item, proposal.pin, {
        note: proposal.note,
      }),
    };
  }
  const withNote = (next: PlayerDocument, pin: string | null) =>
    proposal.note === undefined
      ? next
      : updateWishlistItem(next, profile.id, item, pin, {
          note: proposal.note,
        });
  if (proposal.grace === undefined) {
    const entry = profile.wishlist.find((w) => w.item === item && !w.pin);
    if (entry && (proposal.note === undefined || proposal.note === entry.note))
      return { problem: "already-listed" };
    return { player: withNote(addToWishlist(player, profile.id, item), null) };
  }
  const grace = map.nodes.find((n) => n.id === proposal.grace);
  if (!grace) return { problem: "grace-gone" };
  const node: MapNode = {
    id: newId("junction"),
    layer: grace.layer,
    x: grace.x + PIN_OFFSET,
    y: grace.y,
    kind: "junction",
    label: "",
    ref: null,
    items: [item],
  };
  return {
    player: withNote(addToWishlist(player, profile.id, item, node.id), node.id),
    action: { type: "addNode", node },
  };
}
