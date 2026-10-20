import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join } from "node:path";

// Reads progress out of an Elden Ring PC save (`ER0000.sl2`), read-only. The
// layout follows the community's save documentation (er-save-manager,
// ER-Save-Lib): a BND4 container whose first 10 files are character slots and
// whose 11th (USER_DATA_10) holds the Steam ID and each slot's name.

export const SLOT_COUNT = 10;
const EVENT_FLAG_BYTES = 0x1bf99f;
const FLAGS_PER_BLOCK = 1000;
const BLOCK_BYTES = 125;

export class SaveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Elden Ring's Steam app ID, which names its Windows prefix in Steam's own library. */
const STEAM_APP_ID = "1245620";

const subfolders = async (folder: string) =>
  readdir(folder, { withFileTypes: true }).then(
    (entries) => entries.filter((e) => e.isDirectory()).map((e) => e.name),
    () => [],
  );

/**
 * Where the game may keep saves on this Mac: the save folder (one folder per
 * Steam ID inside) of every Windows user in every CrossOver bottle, and in the
 * prefix Steam itself runs the game in. `searched` lists every place looked
 * at, for when nothing turns up.
 */
export async function defaultSaveRoots(home = homedir()) {
  const support = join(home, "Library/Application Support");
  const bottles = join(support, "CrossOver/Bottles");
  const bottleNames = await subfolders(bottles);
  const prefixes = [
    ...bottleNames.map((b) => join(bottles, b)),
    join(support, "Steam/steamapps/compatdata", STEAM_APP_ID, "pfx"),
  ];
  const roots: string[] = [];
  // With no bottle at all, the bottles folder is where it looked.
  const searched: string[] = bottleNames.length ? [] : [bottles];
  for (const prefix of prefixes) {
    const users = join(prefix, "drive_c/users");
    const names = await subfolders(users);
    if (!names.length) searched.push(prefix);
    for (const user of names) {
      const root = join(users, user, "AppData/Roaming/EldenRing");
      searched.push(root);
      if ((await subfolders(root)).length) roots.push(root);
    }
  }
  return { roots, searched };
}

/**
 * The save files at a location: the file itself, a Steam ID folder holding
 * `ER0000.sl2`, or a save folder with one Steam ID folder per account.
 */
async function saveFiles(location: string): Promise<string[]> {
  const found = await stat(location).catch(() => null);
  if (found?.isFile()) return extname(location) === ".sl2" ? [location] : [];
  if (!found?.isDirectory()) return [];
  const own = join(location, "ER0000.sl2");
  if (
    await stat(own).then(
      (f) => f.isFile(),
      () => false,
    )
  )
    return [own];
  const files = [];
  for (const folder of (await subfolders(location)).filter((f) =>
    STEAM_ID.test(f),
  )) {
    const file = join(location, folder, "ER0000.sl2");
    if (
      await stat(file).then(
        (f) => f.isFile(),
        () => false,
      )
    )
      files.push(file);
  }
  return files;
}

/** The files inside the BND4 container, each with its MD5 checksum checked. */
function containerFiles(save: Buffer): Buffer[] {
  if (save.length < 0x40 || save.toString("latin1", 0, 4) !== "BND4")
    throw new SaveError(422, "This file is not an Elden Ring PC save.");
  const count = save.readUInt32LE(0x0c);
  const files: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const entry = 0x40 + i * 0x20;
    const size = Number(save.readBigUInt64LE(entry + 0x08));
    const offset = save.readUInt32LE(entry + 0x10);
    if (offset + size > save.length)
      throw new SaveError(422, "The save file is cut short.");
    files.push(save.subarray(offset, offset + size));
  }
  if (files.length <= SLOT_COUNT)
    throw new SaveError(422, "This file is not an Elden Ring PC save.");
  return files;
}

/** A file's data after its checksum. A mismatch usually means the game was writing. */
function checkedData(file: Buffer): Buffer {
  const data = file.subarray(16);
  if (!createHash("md5").update(data).digest().equals(file.subarray(0, 16)))
    throw new SaveError(
      409,
      "The save failed its checksum, probably because the game was saving. Try again.",
    );
  return data;
}

const utf16 = (data: Buffer, offset: number) => {
  const text = data.toString("utf16le", offset, offset + 32);
  const end = text.indexOf("\0");
  return end < 0 ? text : text.slice(0, end);
};

export type SaveSummary = {
  steamId: string;
  /** Slots holding a character, with the character's name. */
  slots: { index: number; name: string }[];
};

// USER_DATA_10, after its checksum.
const SUMMARY_STEAM_ID = 0x04;
const SUMMARY_ACTIVE = 0x1954;
const SUMMARY_PROFILES = 0x195e;
const SUMMARY_PROFILE_BYTES = 0x24c;

export function readSummary(save: Buffer): SaveSummary {
  const summary = checkedData(containerFiles(save)[SLOT_COUNT]);
  const slots = [];
  for (let index = 0; index < SLOT_COUNT; index++)
    if (summary[SUMMARY_ACTIVE + index] === 1)
      slots.push({
        index,
        name: utf16(summary, SUMMARY_PROFILES + index * SUMMARY_PROFILE_BYTES),
      });
  return {
    steamId: summary.readBigUInt64LE(SUMMARY_STEAM_ID).toString(),
    slots,
  };
}

/**
 * Walk a character slot to its event flags. The sections before them are
 * listed in order; a number is a fixed size, a function reads a variable one.
 * On the way it reads the last grace rested at.
 */
function locateEventFlags(slot: Buffer): {
  name: string;
  lastGrace: number;
  flags: Buffer;
} {
  const version = slot.readUInt32LE(0);
  if (version === 0) throw new SaveError(404, "That save slot is empty.");
  let at = 0x20;
  // Item handles: weapons and armour carry extra bytes.
  for (let i = 0; i < (version <= 81 ? 5118 : 5120); i++) {
    const kind = (slot.readUInt32LE(at) & 0xf0000000) >>> 0;
    at += kind === 0x80000000 ? 21 : kind === 0x90000000 ? 16 : 8;
  }
  const name = utf16(slot, at + 0x94);
  const counted = (entryBytes: number) => () =>
    4 + slot.readUInt32LE(at) * entryBytes;
  const sized = () => 8 + slot.readUInt32LE(at + 4);
  const sections: (number | (() => number))[] = [
    0x1b0, // player game data
    0xd0, // special effects
    0x58, // equipment indexes
    0x1c, // active weapon slots
    0x58, // equipped item IDs
    0x58, // equipped item handles
    0x9010, // inventory
    0x74, // equipped spells
    0x8c, // equipped items
    0x18, // equipped gestures
    counted(8), // acquired projectiles
    0x9c, // equipped armaments and items
    0xc, // equipped physick
    0x12f, // face data
    0x6010, // storage box
    0x100, // gestures
    counted(4), // unlocked regions
    0x28, // Torrent
    1,
    0x44, // bloodstain
    4 + 4,
    sized, // menu profile
    0x34, // trophy equipment
    0x1b588, // item game data
    sized, // tutorials
  ];
  for (const section of sections)
    at += typeof section === "number" ? section : section();
  // Then: 3 unknown bytes, deaths, character type, online flag, online
  // character type, the last grace rested at, and 9 more bytes.
  const lastGrace = slot.readUInt32LE(at + 3 + 4 + 4 + 1 + 4);
  at += 3 + 4 + 4 + 1 + 4 + 4 + 1 + 4 + 4;
  if (at + EVENT_FLAG_BYTES > slot.length)
    throw new SaveError(422, "The save slot's layout wasn't recognised.");
  return { name, lastGrace, flags: slot.subarray(at, at + EVENT_FLAG_BYTES) };
}

/**
 * Where each block of 1000 flags is stored, from the community's
 * `eventflag_bst.txt` (`block,position` per line).
 */
export function parseFlagTable(text: string): Map<number, number> {
  const table = new Map<number, number>();
  for (const line of text.split("\n")) {
    const match = /^(\d+),(\d+)$/.exec(line.trim());
    if (match) table.set(Number(match[1]), Number(match[2]));
  }
  return table;
}

function isFlagSet(flags: Buffer, table: Map<number, number>, flag: number) {
  const position = table.get(Math.floor(flag / FLAGS_PER_BLOCK));
  if (position === undefined) return false;
  const index = flag % FLAGS_PER_BLOCK;
  const byte = position * BLOCK_BYTES + (index >> 3);
  return byte < flags.length && ((flags[byte] >> (7 - (index & 7))) & 1) === 1;
}

/**
 * Which of `wanted` are set in one character slot, and the last grace rested
 * at: its `bonfireEntityId` + 1000, or 0 for none.
 */
export function readSlotFlags(
  save: Buffer,
  slotIndex: number,
  table: Map<number, number>,
  wanted: number[],
): { name: string; set: number[]; lastGrace: number } {
  const slot = checkedData(containerFiles(save)[slotIndex]);
  const { name, lastGrace, flags } = locateEventFlags(slot);
  return {
    name,
    set: wanted.filter((f) => isFlagSet(flags, table, f)),
    lastGrace,
  };
}

const STEAM_ID = /^\d{1,20}$/;

/** A save file found on disk, with its account and characters. */
export type FoundSave = SaveSummary & { file: string };

/**
 * Reads saves from disk. Each file is read into memory once per request and
 * never written. `POG_SAVE_DIR`, when set, is the only place read,
 * over the player's chosen location and the search.
 */
export class SaveReader {
  constructor(
    private flagTablePath: string,
    private override = process.env.POG_SAVE_DIR,
    private home = homedir(),
  ) {
    if (override !== undefined && (!override || !isAbsolute(override)))
      throw new Error("POG_SAVE_DIR must be an absolute path.");
  }

  /** The places to read: the override, the player's location, or the search. */
  private async roots(location: string | null) {
    if (this.override !== undefined)
      return { roots: [this.override], searched: [this.override] };
    if (location !== null) {
      if (!isAbsolute(location))
        throw new SaveError(400, "The save location must be a full path.");
      return { roots: [location], searched: [location] };
    }
    return defaultSaveRoots(this.home);
  }

  /** Every save at the location (null: everywhere the game keeps them), with its characters. */
  async list(
    location: string | null,
  ): Promise<{ saves: FoundSave[]; searched: string[] }> {
    const { roots, searched } = await this.roots(location);
    const saves: FoundSave[] = [];
    for (const root of roots)
      for (const file of await saveFiles(root)) {
        let summary;
        try {
          summary = readSummary(await readFile(file));
        } catch (error) {
          if (error instanceof SaveError && error.status === 409) throw error;
          continue;
        }
        // The Steam ID folder names the account, even for a save copied from another one.
        const folder = basename(dirname(file));
        saves.push({
          ...summary,
          steamId: STEAM_ID.test(folder) ? folder : summary.steamId,
          file,
        });
      }
    return { saves, searched };
  }

  /**
   * When the saves at the location last changed: each file's modification
   * time and size, without reading them. The automatic import reads the flags
   * only when this changes.
   */
  async stamp(location: string | null): Promise<string> {
    const { roots } = await this.roots(location);
    const parts: string[] = [];
    for (const root of roots)
      for (const file of await saveFiles(root)) {
        const info = await stat(file).catch(() => null);
        if (info) parts.push(`${file}:${info.mtimeMs}:${info.size}`);
      }
    return parts.join("\n");
  }

  async flags(
    location: string | null,
    steamId: string,
    slot: number,
    wanted: number[],
  ) {
    if (!STEAM_ID.test(steamId)) throw new SaveError(400, "Invalid Steam ID.");
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT)
      throw new SaveError(400, "Invalid slot.");
    let table;
    try {
      table = parseFlagTable(await readFile(this.flagTablePath, "utf8"));
    } catch {
      throw new SaveError(
        503,
        "The event flag table is missing. Run npm run extract.",
      );
    }
    const save = (await this.list(location)).saves.find(
      (s) => s.steamId === steamId,
    );
    if (!save)
      throw new SaveError(404, "No save found for that Steam account.");
    return readSlotFlags(await readFile(save.file), slot, table, wanted);
  }
}
