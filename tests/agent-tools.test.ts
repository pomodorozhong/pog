import { describe, expect, it } from "vitest";
import {
  AgentError,
  PIN_OFFSET,
  applyProposal,
  runTool,
  type AgentState,
  type Proposal,
} from "../src/agent/run";
import type { MapDocument, PlayerDocument } from "../src/domain/types";
import type {
  CatalogGrace,
  CatalogItem,
  CatalogPickup,
  GameData,
} from "../src/map/catalog";
import { applyMapAction } from "../src/map/editing";
import { gameGraceNodes, withGameGraces } from "../src/map/graces";
import { activeProfile } from "../src/profiles/profiles";
import { initialDocuments } from "../src/storage/schema";
import { addToWishlist, updateWishlistItem } from "../src/wishlist/wishlist";

const MOONVEIL = "weapon/2010000";
const SEED = "goods/10010";
const TEAR = "goods/10020";
const item = (id: string, en: string, zh: string): CatalogItem => ({
  id,
  type: id.startsWith("weapon") ? "weapon" : "goods",
  paramId: 1,
  name: { en, "zh-TW": zh },
  dlc: false,
  icon: null,
});
const grace = (
  id: string,
  en: string,
  zh: string,
  x: number,
  layer: CatalogGrace["layer"] = "overworld",
): CatalogGrace => ({
  id,
  name: { en, "zh-TW": zh },
  dlc: false,
  layer,
  x,
  y: 500,
  flag: 1,
  legacy: false,
});
const items = [
  item(MOONVEIL, "Moonveil", "名刀月隱"),
  item(SEED, "Golden Seed", "黃金種子"),
  item(TEAR, "Sacred Tear", "聖杯露滴"),
];
const spot = (
  lot: number,
  x: number,
  layer: CatalogPickup["layer"] = "overworld",
): CatalogPickup => ({
  lot,
  flag: lot,
  items: [lot < 10 ? TEAR : SEED],
  layer,
  x,
  y: 520,
  legacy: false,
});
// The tear has one spot, by the second Twin Rest; the seed has three.
const tearSpot = spot(1, 2980);
const seedSpots = [spot(11, 90), spot(12, 1010), spot(13, 310, "underground")];
const graces = [
  grace("grace/1", "Gatefront", "關卡前方", 100),
  grace("grace/2", "Stranded Graveyard", "孤立墓地", 300, "underground"),
  // Two graces sharing a name in different places.
  grace("grace/3", "Twin Rest", "雙子休息處", 1000),
  grace("grace/4", "Twin Rest", "雙子休息處", 3000),
];
const data = {
  byId: new Map<string, CatalogItem | CatalogGrace>(
    [...items, ...graces].map((e) => [e.id, e]),
  ),
  catalog: {
    items,
    graces,
    bosses: [],
    pickups: [tearSpot, ...seedSpots],
    places: [],
    npcs: [],
  },
  pickupsByItem: new Map([
    [TEAR, [tearSpot]],
    [SEED, seedSpots],
  ]),
} as unknown as GameData;

function state(
  player: PlayerDocument = initialDocuments().player,
  doc: MapDocument = initialDocuments().map,
  proposals: Proposal[] = [],
): AgentState {
  return {
    data,
    player,
    map: withGameGraces(doc, gameGraceNodes(graces)),
    proposals,
    outcomes: new Map(),
  };
}

const errorOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AgentError);
    return (error as Error).message;
  }
  throw new Error("expected an AgentError");
};

describe("agent tools", () => {
  it("finds items in either language", () => {
    expect(runTool("search_items", { query: "moon" }, state()).result).toEqual([
      {
        id: MOONVEIL,
        name: { en: "Moonveil", "zh-TW": "名刀月隱" },
        type: "weapon",
        dlc: false,
      },
    ]);
    expect(
      runTool("search_items", { query: "黃金" }, state()).result,
    ).toMatchObject([{ id: SEED }]);
  });

  it("proposes an add without changing anything", () => {
    const s = state();
    const { result, proposal } = runTool(
      "add_to_wishlist",
      { item: MOONVEIL, near_grace: "關卡前方", note: "Cliff" },
      s,
    );
    expect(proposal).toMatchObject({
      kind: "add",
      item: MOONVEIL,
      grace: "grace/1",
      note: "Cliff",
      profile: s.player.activeProfile,
    });
    expect(result).toMatchObject({
      proposal: proposal!.id,
      status: "waiting for review",
    });
    expect(activeProfile(s.player).wishlist).toEqual([]);
    // Asking again gives the same proposal rather than a second one.
    const again = runTool(
      "add_to_wishlist",
      { item: MOONVEIL, near_grace: "Gatefront", note: "Cliff" },
      { ...s, proposals: [proposal!] },
    );
    expect(again.proposal).toBeUndefined();
    expect(again.result).toMatchObject({ proposal: proposal!.id });
  });

  it("explains a grace name that matches no grace or several", () => {
    expect(
      errorOf(() =>
        runTool(
          "add_to_wishlist",
          { item: MOONVEIL, near_grace: "Gatefront Ruins" },
          state(),
        ),
      ),
    ).toContain("Closest: Gatefront");
    expect(
      errorOf(() =>
        runTool(
          "add_to_wishlist",
          { item: MOONVEIL, near_grace: "twin rest" },
          state(),
        ),
      ),
    ).toContain("grace/3 (overworld), grace/4 (overworld)");
    expect(
      runTool(
        "add_to_wishlist",
        { item: MOONVEIL, near_grace: "grace/4" },
        state(),
      ).proposal,
    ).toMatchObject({ grace: "grace/4" });
    expect(
      errorOf(() => runTool("add_to_wishlist", { item: "Moonveil" }, state())),
    ).toContain("search_items");
  });

  it("applies an add beside its grace, with the entry on the new pin", () => {
    const s = state();
    const { proposal } = runTool(
      "add_to_wishlist",
      { item: MOONVEIL, near_grace: "Gatefront", note: "Cliff" },
      s,
    );
    const applied = applyProposal(proposal!, s.player, s.map);
    if ("problem" in applied) throw new Error(applied.problem);
    expect(applied.action).toMatchObject({
      type: "addNode",
      node: {
        layer: "overworld",
        x: 100 + PIN_OFFSET,
        y: 500,
        kind: "junction",
        items: [MOONVEIL],
      },
    });
    const pin = applied.action?.type === "addNode" && applied.action.node.id;
    expect(activeProfile(applied.player).wishlist).toEqual([
      { item: MOONVEIL, pin, status: "needed", note: "Cliff" },
    ]);
    const map = applyMapAction(initialDocuments().map, applied.action!);
    expect(map.nodes).toHaveLength(1);
  });

  it("applies an add with no pin, and notices one already listed", () => {
    const s = state();
    const { proposal } = runTool("add_to_wishlist", { item: SEED }, s);
    const applied = applyProposal(proposal!, s.player, s.map);
    if ("problem" in applied) throw new Error(applied.problem);
    expect(applied.action).toBeUndefined();
    expect(activeProfile(applied.player).wishlist).toEqual([
      { item: SEED, status: "needed", note: "" },
    ]);
    expect(applyProposal(proposal!, applied.player, s.map)).toEqual({
      problem: "already-listed",
    });
  });

  it("proposes notes, asking for the pin when the item is at several", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    const player = addToWishlist(
      addToWishlist(start, id, SEED, "pin-a"),
      id,
      SEED,
    );
    const s = state(player);
    expect(
      errorOf(() => runTool("set_item_note", { item: SEED, note: "x" }, s)),
    ).toContain("several pins");
    expect(
      errorOf(() => runTool("set_item_note", { item: MOONVEIL, note: "x" }, s)),
    ).toContain("add_to_wishlist");
    const { proposal } = runTool(
      "set_item_note",
      { item: SEED, note: "By the tree", pin: null },
      s,
    );
    expect(proposal).toMatchObject({ kind: "note", pin: null });
    const applied = applyProposal(proposal!, player, s.map);
    if ("problem" in applied) throw new Error(applied.problem);
    expect(activeProfile(applied.player).wishlist).toEqual([
      { item: SEED, pin: "pin-a", status: "needed", note: "" },
      { item: SEED, status: "needed", note: "By the tree" },
    ]);
    // Gone from the wishlist before the player applied it.
    expect(applyProposal(proposal!, start, s.map)).toEqual({
      problem: "entry-gone",
    });
  });

  it("won't apply a proposal for another playthrough", () => {
    const s = state();
    const { proposal } = runTool("add_to_wishlist", { item: SEED }, s);
    expect(
      applyProposal(
        { ...proposal!, profile: "profile-other" },
        s.player,
        s.map,
      ),
    ).toEqual({ problem: "other-playthrough" });
  });

  it("lists the wishlist with pins in words and proposals waiting", () => {
    const start = initialDocuments().player;
    const doc: MapDocument = {
      ...initialDocuments().map,
      nodes: [
        {
          id: "pin-a",
          layer: "overworld",
          x: 120,
          y: 500,
          kind: "junction",
          label: "",
          ref: null,
          items: [SEED],
        },
      ],
    };
    const player = addToWishlist(start, start.activeProfile, SEED, "pin-a");
    const waiting: Proposal = {
      id: "proposal-1",
      kind: "add",
      profile: start.activeProfile,
      item: MOONVEIL,
    };
    const { result } = runTool(
      "get_wishlist",
      {},
      state(player, doc, [waiting]),
    );
    expect(result).toEqual({
      playthrough: "Untitled playthrough",
      attached_to_pins: [
        {
          item: SEED,
          name: { en: "Golden Seed", "zh-TW": "黃金種子" },
          pin: "pin-a",
          pin_name: "a pin near Gatefront",
          status: "needed",
          note: "",
        },
      ],
      not_attached: [],
      proposals_waiting: [
        {
          id: "proposal-1",
          kind: "add",
          item: MOONVEIL,
          name: { en: "Moonveil", "zh-TW": "名刀月隱" },
        },
      ],
    });
  });

  it("reports what happened to proposals", () => {
    const s = state();
    const waiting: Proposal = {
      id: "proposal-1",
      kind: "add",
      profile: s.player.activeProfile,
      item: SEED,
    };
    expect(
      runTool(
        "get_proposal_status",
        { ids: ["proposal-1", "proposal-2", "proposal-3"] },
        {
          ...s,
          proposals: [waiting],
          outcomes: new Map([["proposal-2", "dismissed"]]),
        },
      ).result,
    ).toEqual([
      { id: "proposal-1", status: "waiting" },
      { id: "proposal-2", status: "dismissed" },
      { id: "proposal-3", status: "unknown" },
    ]);
  });

  it("puts an item with one spot in the game on a new pin there, naming its region", () => {
    const s = state();
    const { result, proposal } = runTool("add_to_wishlist", { item: TEAR }, s);
    expect(result).toMatchObject({
      pin: "a new pin on the item's spot in the game",
      region: "Twin Rest",
    });
    expect(proposal).toMatchObject({
      kind: "add",
      spot: { layer: "overworld", x: 2980, y: 520 },
    });
    const applied = applyProposal(proposal!, s.player, s.map);
    if ("problem" in applied) throw new Error(applied.problem);
    const node = applied.action?.type === "addNode" && applied.action.node;
    expect(node).toMatchObject({ layer: "overworld", x: 2980, y: 520 });
    expect(activeProfile(applied.player).wishlist).toEqual([
      { item: TEAR, pin: node && node.id, status: "needed", note: "" },
    ]);
    // A grace the agent names still wins.
    expect(
      runTool("add_to_wishlist", { item: TEAR, near_grace: "Gatefront" }, s)
        .proposal,
    ).not.toHaveProperty("spot");
  });

  it("lists the regions of an item's spots when it has several", () => {
    const { result, proposal } = runTool(
      "add_to_wishlist",
      { item: SEED },
      state(),
    );
    expect(proposal).not.toHaveProperty("spot");
    expect(result).toMatchObject({
      pin: "not attached to a pin",
      item_spots: 3,
      regions: [
        { near_grace: "Gatefront", layer: "overworld" },
        { near_grace: "Twin Rest", layer: "overworld" },
        { near_grace: "Stranded Graveyard", layer: "underground" },
      ],
    });
    expect((result as { hint: string }).hint).toContain("near_grace");
  });

  it("moves an entry already on the wishlist onto the spot's pin instead of adding another", () => {
    const start = initialDocuments().player;
    const player = updateWishlistItem(
      addToWishlist(start, start.activeProfile, TEAR),
      start.activeProfile,
      TEAR,
      null,
      { status: "acquired", note: "Mine" },
    );
    const s = state(player);
    const { proposal } = runTool("add_to_wishlist", { item: TEAR }, s);
    const applied = applyProposal(proposal!, player, s.map);
    if ("problem" in applied) throw new Error(applied.problem);
    const node = applied.action?.type === "addNode" && applied.action.node;
    expect(activeProfile(applied.player).wishlist).toEqual([
      { item: TEAR, status: "acquired", note: "Mine", pin: node && node.id },
    ]);

    // Asked again once applied: the item is already on a pin at its spot.
    const map = applyMapAction(s.map, applied.action!);
    const again = runTool(
      "add_to_wishlist",
      { item: TEAR },
      { ...s, player: applied.player, map },
    ).proposal!;
    expect(applyProposal(again, applied.player, map)).toEqual({
      problem: "already-listed",
    });
    // A new note for it only changes the note.
    const noted = applyProposal(
      { ...again, kind: "add", note: "Second" } as Proposal,
      applied.player,
      map,
    );
    if ("problem" in noted) throw new Error(noted.problem);
    expect(noted.action).toBeUndefined();
    expect(activeProfile(noted.player).wishlist).toEqual([
      { item: TEAR, status: "acquired", note: "Second", pin: node && node.id },
    ]);
  });
});
