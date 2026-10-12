// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseFlagTable,
  readSlotFlags,
  readSummary,
  SaveError,
} from "../server/save";
import { planImport } from "../src/progress/importSave";
import { initialDocuments, validDocument } from "../src/storage/schema";

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

/** A character slot with one weapon handle (if asked) and the Roundtable Hold flag. */
function slot(name: string, weapon = false) {
  const data = Buffer.alloc(SLOT_BYTES);
  data.writeUInt32LE(261, 0);
  if (weapon) data.writeUInt32LE(0x80000001, 0x20);
  const extra = weapon ? 13 : 0;
  utf16(name).copy(data, 0x20 + 5120 * 8 + extra + 0x94);
  // Flag 71190: block 71 at position 0, byte 190 / 8, bit 7 - 190 % 8.
  data[EMPTY_SLOT_FLAGS + extra + 23] = 1 << 1;
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
    const file = save([slot("Burning"), null, slot("Tarnished", true)]);
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
    });
    // A weapon handle is longer, which moves everything after it.
    expect(readSlotFlags(file, 2, table, [ROUNDTABLE])).toEqual({
      name: "Tarnished",
      set: [ROUNDTABLE],
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

describe("planning an import", () => {
  it("takes the save's word for the flags it was asked about", () => {
    const progress = { flags: [1, 2, 99], position: null };
    expect(planImport(progress, [1, 2, 3], [1, 3])).toEqual({
      added: [3],
      removed: [2],
      flags: [1, 3, 99],
    });
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
});
