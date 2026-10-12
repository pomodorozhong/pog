import type { DocumentKey, DocumentName, Documents } from "../domain/types";
import { initialDocuments, validDocument } from "./schema";

export const storageUrl = (key: DocumentKey) => `/api/state/${key}`;
export type LoadedDocument<N extends DocumentName> = {
  state: Documents[N];
  /** False when the saved file could not be read; edits then stay in memory. */
  canSave: boolean;
  recovery?: string;
};
export type SaveResult = "saved" | "failed" | "conflict";

// One queue per document keeps successive edits in order. The server revision
// prevents this window from overwriting a save made by another window or server.
export function createStorageClient<N extends DocumentName>(
  name: N,
  key: DocumentKey,
  request: typeof fetch = fetch,
) {
  let revision: string | null = null;
  let canSave = false;
  let saving: Promise<void> | null = null;
  let pending: {
    raw: string;
    resolve: ((result: SaveResult) => void)[];
  } | null = null;

  async function write(raw: string): Promise<SaveResult> {
    if (!canSave) return "conflict";
    try {
      const response = await request(storageUrl(key), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: `{"revision":${JSON.stringify(revision)},"state":${raw}}`,
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 409) {
        canSave = false;
        return "conflict";
      }
      if (!response.ok) return "failed";
      const body = await response.json();
      if (typeof body.revision !== "string") return "failed";
      revision = body.revision;
      return "saved";
    } catch {
      return "failed";
    }
  }

  async function flush() {
    while (pending) {
      const snapshot = pending;
      pending = null;
      const result = await write(snapshot.raw);
      snapshot.resolve.forEach((resolve) => resolve(result));
    }
    saving = null;
  }

  return {
    async load(): Promise<LoadedDocument<N>> {
      // A document opened again right after leaving it reads its last save.
      await saving;
      canSave = false;
      let recovery: string | undefined;
      try {
        const response = await request(storageUrl(key), {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        const body = await response.json();
        recovery =
          typeof body.recovery === "string" ? body.recovery : undefined;
        if (
          !response.ok ||
          !(body.revision === null || typeof body.revision === "string") ||
          !(body.state === null || validDocument(name, body.state))
        )
          throw new Error("Invalid storage response");
        revision = body.revision;
        canSave = true;
        return { state: body.state ?? initialDocuments()[name], canSave: true };
      } catch {
        return { state: initialDocuments()[name], canSave: false, recovery };
      }
    },
    save(state: Documents[N]): Promise<SaveResult> {
      return new Promise((resolve) => {
        const raw = JSON.stringify(state);
        // Full snapshots supersede intermediate pending edits. At most one
        // write and one latest snapshot wait on a slow or unavailable disk.
        if (pending) {
          pending.raw = raw;
          pending.resolve.push(resolve);
        } else pending = { raw, resolve: [resolve] };
        saving ??= flush();
      });
    },
  };
}
