import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import lockfile from "proper-lockfile";
import type {
  DocumentKey,
  DocumentName,
  Documents,
  PlayerDocument,
} from "../src/domain/types.ts";
import {
  FIRST_PROFILE_ID,
  documentNameOf,
  mapKey,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema.ts";
import { resolveStoragePaths } from "./paths.ts";

export const MAX_SAVE_BYTES = 4 * 1024 * 1024;
export class StorageError extends Error {
  constructor(
    public status: number,
    message: string,
    public recovery?: string,
  ) {
    super(message);
  }
}
const revisionOf = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException).code;

/** Move a file to `target` without replacing anything already there. */
async function moveWithoutReplacing(source: string, target: string) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await link(source, target);
  await unlink(source);
}

function nameOf(key: DocumentKey): DocumentName {
  const name = documentNameOf(key);
  if (!name) throw new StorageError(404, "Unknown document.");
  return name;
}

// Each document (player state, each profile's map) is its own JSON file.
export class FileStore {
  constructor(private paths = resolveStoragePaths()) {}

  async read(
    key: DocumentKey,
  ): Promise<{
    state: Documents[DocumentName] | null;
    revision: string | null;
  }> {
    const name = nameOf(key);
    if (key === mapKey(FIRST_PROFILE_ID)) await this.moveLegacyMap();
    let raw: string;
    try {
      raw = await readFile(this.paths.document(key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { state: null, revision: null };
      throw new StorageError(
        503,
        "Saved data cannot be read. Check the data directory permissions and availability.",
      );
    }
    try {
      const state = upgradeDocument(name, JSON.parse(raw));
      if (
        Buffer.byteLength(raw) > MAX_SAVE_BYTES ||
        !validDocument(name, state)
      )
        throw new Error("Invalid state");
      return { state, revision: revisionOf(raw) };
    } catch {
      throw new StorageError(
        422,
        "Saved data is invalid or unsupported. The original file is preserved.",
        raw,
      );
    }
  }

  async write(key: DocumentKey, state: unknown, revision: unknown) {
    const name = nameOf(key);
    if (
      !validDocument(name, state) ||
      !(revision === null || typeof revision === "string")
    )
      throw new StorageError(400, "Invalid saved state or revision.");
    const raw = JSON.stringify(state, null, 1);
    if (Buffer.byteLength(raw) > MAX_SAVE_BYTES)
      throw new StorageError(413, "Saved data exceeds the 4 MiB limit.");
    const path = this.paths.document(key);
    let release: (() => Promise<void>) | undefined;
    let compromised = false;
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      // Lock across dev/preview processes too. A crashed process's lock expires;
      // the committed file stays intact until an atomic rename completes.
      release = await lockfile.lock(path, {
        realpath: false,
        stale: 10000,
        retries: { retries: 10, minTimeout: 25, maxTimeout: 100 },
        onCompromised: () => {
          compromised = true;
        },
      });
      const current = await this.read(key);
      if (current.revision !== revision)
        throw new StorageError(
          409,
          "Saved data changed in another window. Reload before saving again.",
        );
      if (current.revision === revisionOf(raw))
        return { revision: current.revision };
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(raw);
        await file.sync();
      } finally {
        await file.close();
      }
      if (compromised)
        throw new StorageError(
          503,
          "The save lock was lost. The previous file is preserved.",
        );
      await rename(temporary, path);
      if (name === "player")
        await this.keepDeletedMaps(
          current.state as PlayerDocument | null,
          state as PlayerDocument,
        );
      return { revision: revisionOf(raw) };
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        503,
        "Changes cannot be saved. Check that the data directory is writable, available, and has free space.",
      );
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
      await release?.().catch(() => {});
    }
  }

  /** Before profiles had their own maps, `map.json` was the only map; it becomes the first profile's. */
  private async moveLegacyMap() {
    try {
      await moveWithoutReplacing(
        this.paths.legacyMap,
        this.paths.document(mapKey(FIRST_PROFILE_ID)),
      );
    } catch (error) {
      // Nothing to move, or the first profile already has a map: leave both as they are.
      if (!["ENOENT", "EEXIST"].includes(errorCode(error) ?? ""))
        throw new StorageError(
          503,
          "Saved data cannot be read. Check the data directory permissions and availability.",
        );
    }
  }

  /** A deleted profile's map moves to `deleted/maps/` rather than being removed. */
  private async keepDeletedMaps(
    before: PlayerDocument | null,
    after: PlayerDocument,
  ) {
    const kept = new Set(after.profiles.map((p) => p.id));
    for (const { id } of before?.profiles ?? []) {
      if (kept.has(id)) continue;
      const source = this.paths.document(mapKey(id));
      for (let attempt = 0; attempt < 5; attempt++) {
        const suffix = attempt ? `-${Date.now()}-${attempt}` : "";
        try {
          await moveWithoutReplacing(
            source,
            join(this.paths.deletedMaps, `${id}${suffix}.json`),
          );
          break;
        } catch (error) {
          // No map saved yet, or the move failed: the map stays where it is.
          if (errorCode(error) !== "EEXIST") break;
        }
      }
    }
  }
}
