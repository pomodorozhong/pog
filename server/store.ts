import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import lockfile from "proper-lockfile";
import type { DocumentName, Documents } from "../src/domain/types.ts";
import { upgradeDocument, validDocument } from "../src/storage/schema.ts";
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

// Each document (player-authored map data, player state) is its own JSON file.
export class FileStore {
  constructor(private paths = resolveStoragePaths()) {}

  async read<N extends DocumentName>(
    name: N,
  ): Promise<{ state: Documents[N] | null; revision: string | null }> {
    let raw: string;
    try {
      raw = await readFile(this.paths.document(name), "utf8");
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

  async write(name: DocumentName, state: unknown, revision: unknown) {
    if (
      !validDocument(name, state) ||
      !(revision === null || typeof revision === "string")
    )
      throw new StorageError(400, "Invalid saved state or revision.");
    const raw = JSON.stringify(state, null, 1);
    if (Buffer.byteLength(raw) > MAX_SAVE_BYTES)
      throw new StorageError(413, "Saved data exceeds the 4 MiB limit.");
    const path = this.paths.document(name);
    let release: (() => Promise<void>) | undefined;
    let compromised = false;
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(this.paths.data, { recursive: true, mode: 0o700 });
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
      const current = await this.read(name);
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
}
