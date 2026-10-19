import { describe, expect, it } from "vitest";
import type { MapNode } from "../src/domain/types";
import type { CatalogGrace, GameData } from "../src/map/catalog";
import { activeProfile } from "../src/profiles/profiles";
import {
  beatenBosses,
  discoveredCount,
  setFlag,
  setPosition,
  undiscoveredGraces,
} from "../src/progress/progress";
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";

const grace = (id: string, flag: number): CatalogGrace => ({
  id,
  name: { en: id, "zh-TW": id },
  dlc: false,
  layer: "overworld",
  x: 0,
  y: 0,
  flag,
  legacy: false,
});
const graces = [grace("place/1", 71000), grace("place/2", 71001)];
const data = {
  catalog: { items: [], graces, bosses: [], places: [], npcs: [] },
  graceFlags: new Map(graces.map((g) => [g.id, g.flag])),
} as unknown as GameData;
const node = (id: string, kind: MapNode["kind"], ref: string | null) => ({
  id,
  layer: "overworld" as const,
  x: 0,
  y: 0,
  kind,
  label: "",
  ref,
});

describe("progress", () => {
  it("sets flags in order and tracks the position", () => {
    const start = initialDocuments().player;
    const id = start.activeProfile;
    let player = setFlag(start, id, 71001, true);
    player = setFlag(player, id, 71000, true);
    player = setFlag(player, id, 71000, true);
    expect(activeProfile(player).progress.flags).toEqual([71000, 71001]);
    player = setFlag(player, id, 71001, false);
    player = setPosition(player, id, "grace-a");
    expect(activeProfile(player).progress).toEqual({
      flags: [71000],
      position: "grace-a",
    });
    expect(validDocument("player", player)).toBe(true);
    expect(discoveredCount(data, activeProfile(player).progress)).toBe(1);
  });

  it("finds graces on the map that aren't discovered yet", () => {
    const nodes = [
      node("a", "grace", "place/1"),
      node("b", "grace", "place/2"),
      node("c", "grace", null),
      node("d", "junction", null),
    ];
    expect(
      undiscoveredGraces(data, nodes, { flags: [71000], position: null }),
    ).toEqual(new Set(["b"]));
  });

  it("finds the bosses beaten, including every boss sharing a flag", () => {
    const boss = (id: string, flag: number) => ({
      id,
      name: { en: id, "zh-TW": id },
      dlc: false,
      flag,
    });
    const withBosses = {
      ...data,
      catalog: {
        ...data.catalog,
        bosses: [
          boss("boss/1", 9001),
          boss("boss/2", 9002),
          boss("boss/3", 9001),
        ],
      },
    } as GameData;
    expect(beatenBosses(withBosses, { flags: [9001], position: null })).toEqual(
      new Set(["boss/1", "boss/3"]),
    );
    expect(beatenBosses(withBosses, null)).toEqual(new Set());
  });

  it("rejects unsorted or repeated flags", () => {
    const player = initialDocuments().player;
    const withFlags = (flags: number[]) => ({
      ...player,
      profiles: [
        { ...player.profiles[0], progress: { flags, position: null } },
      ],
    });
    expect(validDocument("player", withFlags([1, 2]))).toBe(true);
    expect(validDocument("player", withFlags([2, 1]))).toBe(false);
    expect(validDocument("player", withFlags([1, 1]))).toBe(false);
  });

  it("gives version 3 profiles empty progress, keeping their wishlist", () => {
    const player = initialDocuments().player;
    const wishlist = [{ item: "weapon/1", status: "needed", note: "" }];
    const v3 = {
      ...player,
      schemaVersion: 3,
      profiles: [
        { id: "profile-1", name: "", goal: "", constraints: "", wishlist },
      ],
    };
    expect(upgradeDocument("player", v3)).toEqual({
      ...player,
      profiles: [{ ...player.profiles[0], wishlist }],
    });
  });
});
