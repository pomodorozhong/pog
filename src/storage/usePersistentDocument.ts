import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentKey, DocumentName, Documents } from "../domain/types";
import {
  createStorageClient,
  type LoadedDocument,
  type SaveResult,
} from "./client";

export type SaveStatus = "loading" | "saved" | "saving" | SaveResult | "memory";

type Session<N extends DocumentName> = {
  key: DocumentKey;
  loaded: Documents[N] | null;
  /** The latest edit not handed to the client yet. */
  unsaved: Documents[N] | null;
};

/**
 * Load the document saved under `key`, then save it whenever `state` changes
 * after loading. Saves are debounced; the client keeps them in order. When
 * `key` changes (another profile's map), the last edit of the old document is
 * saved at once and the new one is loaded. A null key loads nothing yet.
 * A read-only document (on a mirror) loads but never saves.
 */
export function usePersistentDocument<N extends DocumentName>(
  name: N,
  key: DocumentKey | null,
  state: Documents[N] | null,
  onLoad: (state: Documents[N], key: DocumentKey) => void,
  {
    delay = 400,
    readOnly = false,
  }: { delay?: number; readOnly?: boolean } = {},
) {
  // One client per document, so reopening one waits for its pending saves.
  const clients = useRef(
    new Map<DocumentKey, ReturnType<typeof createStorageClient<N>>>(),
  );
  const clientFor = useCallback(
    (key: DocumentKey) => {
      let client = clients.current.get(key);
      if (!client) {
        client = createStorageClient(name, key);
        clients.current.set(key, client);
      }
      return client;
    },
    [name],
  );
  const session = useRef<Session<N> | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [recovery, setRecovery] = useState<string>();
  const [statusKey, setStatusKey] = useState(key);
  if (statusKey !== key) {
    setStatusKey(key);
    setStatus("loading");
  }

  useEffect(() => {
    if (!key) return;
    const current: Session<N> = { key, loaded: null, unsaved: null };
    session.current = current;
    let cancelled = false;
    void clientFor(key)
      .load()
      .then((result) => {
        if (cancelled) return;
        current.loaded = result.state;
        setRecovery(result.recovery);
        setStatus(result.canSave ? "saved" : "memory");
        onLoad(result.state, key);
      });
    return () => {
      cancelled = true;
      if (current.unsaved && !readOnly)
        void clientFor(key).save(current.unsaved);
      current.unsaved = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, clientFor]);

  useEffect(() => {
    const current = session.current;
    if (
      readOnly ||
      !state ||
      !current?.loaded ||
      state === current.loaded ||
      status === "memory" ||
      status === "conflict"
    )
      return;
    current.unsaved = state;
    const timer = setTimeout(() => {
      if (!current.unsaved) return;
      current.unsaved = null;
      setStatus("saving");
      void clientFor(current.key)
        .save(state)
        .then((result) => {
          if (session.current === current) setStatus(result);
        });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /** Read another document of the same kind, after any save still waiting for it. */
  const read = useCallback(
    (other: DocumentKey): Promise<LoadedDocument<N>> => clientFor(other).load(),
    [clientFor],
  );

  return { status, recovery, read };
}
