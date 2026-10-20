// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseFlagTable,
  readSlotFlags,
  readSummary,
  SaveError,
  SaveReader,
} from "../server/save";
import type { MapDocument, Progress } from "../src/domain/types";
import type { CatalogGrace, GameData } from "../src/map/catalog";
import { gameGraceNodes } from "../src/map/graces";
import { lastGraceOnMap, planImport } from "../src/progress/importSave";
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";

const SLOT_BYTES = 0x280000;
/** Where an empty slot's event flags start: every variable section is empty. */
const EMPTY_SLOT_FLAGS = 0x34e39;
const ROUNDTABLE = 71190;
const table = parseFlagTable("71,0\n10,1\n");

const withChecksum = (data: Buffer) =>
  Buffer.concat([createHash("md5").update(data).digest(), data]);

function utf16(text: string) {
  const name = Buffer.alloc(32);
  name.write(text, "utf16le");
  return name;
}

/**
 * A character slot with one weapon handle (if asked), the Roundtable Hold
 * flag and the last grace rested at.
 */
function slot(name: string, weapon = false, lastGrace = 0) {
  const data = Buffer.alloc(SLOT_BYTES);
  data.writeUInt32LE(261, 0);
  if (weapon) data.writeUInt32LE(0x80000001, 0x20);
  const extra = weapon ? 13 : 0;
  utf16(name).copy(data, 0x20 + 5120 * 8 + extra + 0x94);
  // Flag 71190: block 71 at position 0, byte 190 / 8, bit 7 - 190 % 8.
  data[EMPTY_SLOT_FLAGS + extra + 23] = 1 << 1;
  // 13 bytes before the flags: the last grace, then 9 more bytes.
  data.writeUInt32LE(lastGrace, EMPTY_SLOT_FLAGS + extra - 13);
  return withChecksum(data);
}

function save(slots: (Buffer | null)[], steamId = 76561198000000001n) {
  const summary = Buffer.alloc(0x60000);
  summary.writeBigUInt64LE(steamId, 0x04);
  const files = [...slots];
  while (files.length < 10) files.push(null);
  files.forEach((file, i) => {
    if (!file) return;
    summary[0x1954 + i] = 1;
    utf16(file.subarray(16).readUInt32LE(0) ? `#${i}` : "").copy(
      summary,
      0x195e + i * 0x24c,
    );
  });
  const contents = [
    ...files.map((f) => f ?? withChecksum(Buffer.alloc(SLOT_BYTES))),
    withChecksum(summary),
  ];
  const header = Buffer.alloc(0x40 + contents.length * 0x20);
  header.write("BND4", 0, "latin1");
  header.writeUInt32LE(contents.length, 0x0c);
  let offset = header.length;
  contents.forEach((file, i) => {
    header.writeBigUInt64LE(BigInt(file.length), 0x40 + i * 0x20 + 0x08);
    header.writeUInt32LE(offset, 0x40 + i * 0x20 + 0x10);
    offset += file.length;
  });
  return Buffer.concat([header, ...contents]);
}

describe("reading the game save", () => {
  it("lists characters and reads their flags", () => {
    const file = save([
      slot("Burning", false, 1042372950),
      null,
      slot("Tarnished", true),
    ]);
    expect(readSummary(file)).toEqual({
      steamId: "76561198000000001",
      slots: [
        { index: 0, name: "#0" },
        { index: 2, name: "#2" },
      ],
    });
    expect(readSlotFlags(file, 0, table, [ROUNDTABLE, 10000])).toEqual({
      name: "Burning",
      set: [ROUNDTABLE],
      lastGrace: 1042372950,
    });
    // A weapon handle is longer, which moves everything after it.
    expect(readSlotFlags(file, 2, table, [ROUNDTABLE])).toEqual({
      name: "Tarnished",
      set: [ROUNDTABLE],
      lastGrace: 0,
    });
  });

  it("refuses a slot whose checksum doesn't match", () => {
    const file = save([slot("Burning")]);
    file[0x40 + 11 * 0x20 + 100] ^= 1;
    const read = () => readSlotFlags(file, 0, table, [ROUNDTABLE]);
    expect(read).toThrow(SaveError);
    expect(read).toThrow(/checksum/);
  });
});

describe("finding the save", () => {
  const STEAM = "76561198000000001";
  const ROAMING = "AppData/Roaming/EldenRing";
  let home: string;
  let flagTable: string;
  const support = () => join(home, "Library/Application Support");
  const bottle = (name: string) =>
    join(support(), "CrossOver/Bottles", name, "drive_c/users");
  const steamPrefix = () =>
    join(support(), "Steam/steamapps/compatdata/1245620/pfx/drive_c/users");

  async function put(folder: string, file: Buffer) {
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "ER0000.sl2"), file);
    return join(folder, "ER0000.sl2");
  }

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "pog saves "));
    flagTable = join(home, "eventflag_bst.txt");
    await writeFile(flagTable, "71,0\n10,1\n");
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  it("looks in every CrossOver bottle and in Steam's own prefix", async () => {
    const inBottle = await put(
      join(bottle("Steam"), "crossover", ROAMING, STEAM),
      save([slot("Burning")]),
    );
    const inSteam = await put(
      join(steamPrefix(), "steamuser", ROAMING, STEAM),
      save([slot("Tarnished")]),
    );
    await mkdir(
      join(home, "Library/Application Support/CrossOver/Bottles/itchio"),
      {
        recursive: true,
      },
    );
    const reader = new SaveReader(flagTable, undefined, home);
    const { saves, searched } = await reader.list(null);
    // The same account in two places shows twice, told apart by the file.
    expect(saves.map((s) => [s.file, s.steamId])).toEqual([
      [inBottle, STEAM],
      [inSteam, STEAM],
    ]);
    expect(searched).toEqual([
      join(bottle("Steam"), "crossover", ROAMING),
      join(support(), "CrossOver/Bottles/itchio"),
      join(steamPrefix(), "steamuser", ROAMING),
    ]);
  });

  it("says where it looked when there is no bottle and no save", async () => {
    const reader = new SaveReader(flagTable, undefined, home);
    expect(await reader.list(null)).toEqual({
      saves: [],
      searched: [
        join(support(), "CrossOver/Bottles"),
        join(support(), "Steam/steamapps/compatdata/1245620/pfx"),
      ],
    });
  });

  it("reads a chosen save folder, Steam ID folder or file", async () => {
    const folder = join(home, "copied", "EldenRing");
    const file = await put(join(folder, STEAM), save([slot("Burning")]));
    // A copy of the file under another name, outside any Steam ID folder.
    const copy = join(home, "backup.sl2");
    await writeFile(copy, save([slot("Burning")], 76561198000000002n));
    const reader = new SaveReader(flagTable, undefined, home);
    for (const location of [folder, join(folder, STEAM), file])
      expect((await reader.list(location)).saves.map((s) => s.file)).toEqual([
        file,
      ]);
    expect((await reader.list(copy)).saves[0].steamId).toBe(
      "76561198000000002",
    );
    expect(await reader.flags(file, STEAM, 0, [ROUNDTABLE])).toEqual({
      name: "Burning",
      set: [ROUNDTABLE],
      lastGrace: 0,
    });
    await expect(reader.flags(file, "1", 0, [ROUNDTABLE])).rejects.toThrow(
      "No save found",
    );
    await expect(reader.list("copied")).rejects.toThrow("full path");
  });

  it("notices when the game writes the save, without reading it", async () => {
    const file = await put(join(home, "chosen", STEAM), save([slot("A")]));
    const reader = new SaveReader(flagTable, undefined, home);
    const before = await reader.stamp(file);
    expect(before).toContain(file);
    expect(await reader.stamp(file)).toBe(before);
    await writeFile(file, save([slot("A"), slot("B")]));
    expect(await reader.stamp(file)).not.toBe(before);
    expect(await reader.stamp(join(home, "nothing"))).toBe("");
  });

  it("reads only POG_SAVE_DIR when it is set", async () => {
    const override = join(home, "override");
    const file = await put(join(override, STEAM), save([slot("Burning")]));
    const chosen = await put(join(home, "chosen", STEAM), save([slot("X")]));
    const reader = new SaveReader(flagTable, override, home);
    expect((await reader.list(chosen)).saves.map((s) => s.file)).toEqual([
      file,
    ]);
    expect(() => new SaveReader(flagTable, "relative", home)).toThrow(
      "absolute",
    );
  });
});

describe("planning an import", () => {
  it("takes the save's word for the flags it was asked about", () => {
    const progress = { flags: [1, 2, 99], position: null };
    expect(planImport(progress, [1, 2, 3], [1, 3])).toEqual({
      added: [3],
      removed: [2],
      flags: [1, 3, 99],
      lastGrace: null,
      moveTo: null,
    });
  });

  it("moves the position only when the last grace changes", () => {
    const at = (position: string | null, lastGrace?: string) => ({
      flags: [],
      position,
      ...(lastGrace && { lastGrace }),
    });
    const plan = (progress: Progress, lastGrace: string | null) => {
      const { lastGrace: rested, moveTo } = planImport(
        progress,
        [],
        [],
        lastGrace,
      );
      return { rested, moveTo };
    };
    expect(plan(at("grace/1"), "grace/2")).toEqual({
      rested: "grace/2",
      moveTo: "grace/2",
    });
    // Set by hand since: it stays until the character rests somewhere new.
    expect(plan(at("pin-1", "grace/2"), "grace/2")).toEqual({
      rested: null,
      moveTo: null,
    });
    expect(plan(at("grace/2", "grace/1"), "grace/2")).toEqual({
      rested: "grace/2",
      moveTo: null,
    });
    // A save that names no grace changes nothing.
    expect(plan(at("pin-1", "grace/2"), null)).toEqual({
      rested: null,
      moveTo: null,
    });
  });

  it("finds the map's grace the save names, or its shown twin", () => {
    const grace = (id: string, entity: number, x = 0) => ({
      id,
      name: {
        en: id === "grace/3" ? "Gatefront" : "Elden Throne",
        "zh-TW": "",
      },
      layer: "overworld",
      x,
      y: 0,
      flag: 1,
      entity,
      legacy: false,
    });
    // grace/2 is grace/1's ashen twin, hidden behind it on the map.
    const graces = [
      grace("grace/1", 11001950),
      grace("grace/2", 11051950, 2),
      grace("grace/3", 1042371950, 500),
    ];
    const data = {
      catalog: { graces },
      byId: new Map(graces.map((g) => [g.id, g])),
    } as unknown as GameData;
    const doc = {
      schemaVersion: 4,
      nodes: gameGraceNodes(graces as CatalogGrace[]),
      edges: [],
    } as MapDocument;
    expect(lastGraceOnMap(data, doc, 1042372950)).toBe("grace/3");
    expect(lastGraceOnMap(data, doc, 11052950)).toBe("grace/1");
    expect(lastGraceOnMap(data, doc, 0)).toBeNull();
  });

  it("validates the last grace rested at", () => {
    const player = initialDocuments().player;
    const resting = (lastGrace: unknown) => ({
      ...player,
      profiles: [
        {
          ...player.profiles[0],
          progress: { ...player.profiles[0].progress, lastGrace },
        },
      ],
    });
    expect(validDocument("player", player)).toBe(true);
    expect(validDocument("player", resting("grace/61423700"))).toBe(true);
    expect(validDocument("player", resting("pin-1"))).toBe(false);
  });

  it("validates the linked save slot", () => {
    const player = initialDocuments().player;
    const linked = (save: unknown) => ({
      ...player,
      profiles: [{ ...player.profiles[0], save }],
    });
    const link = { steamId: "76561198000000001", slot: 0, name: "Burning" };
    expect(validDocument("player", linked(link))).toBe(true);
    expect(validDocument("player", linked({ ...link, slot: 10 }))).toBe(false);
    expect(validDocument("player", linked({ ...link, steamId: "../x" }))).toBe(
      false,
    );
  });

  it("imports automatically by default from version 12", () => {
    const player = initialDocuments().player;
    expect(player.autoImport).toBe(true);
    const legacy: Record<string, unknown> = { ...player, schemaVersion: 11 };
    delete legacy.autoImport;
    expect(validDocument("player", legacy)).toBe(false);
    expect(upgradeDocument("player", legacy)).toEqual(player);
    expect(validDocument("player", { ...player, autoImport: "yes" })).toBe(
      false,
    );
  });

  it("remembers the save location, a full path, from version 11", () => {
    const player = initialDocuments().player;
    expect(player.saveLocation).toBeNull();
    const legacy: Record<string, unknown> = { ...player, schemaVersion: 10 };
    delete legacy.saveLocation;
    expect(validDocument("player", legacy)).toBe(false);
    expect(upgradeDocument("player", legacy)).toEqual(player);
    const at = (saveLocation: unknown) =>
      validDocument("player", { ...player, saveLocation });
    expect(at("/Users/me/EldenRing/1/ER0000.sl2")).toBe(true);
    expect(at("EldenRing")).toBe(false);
    expect(at(1)).toBe(false);
  });
});
