import { useEffect, useRef, useState } from "react";
import type { DocumentName, Documents } from "../domain/types";
import { createStorageClient, type SaveResult } from "./client";

export type SaveStatus = "loading" | "saved" | "saving" | SaveResult | "memory";

/**
 * Load a document once, then save it whenever `state` changes after loading.
 * Saves are debounced; the client keeps them in order.
 */
export function usePersistentDocument<N extends DocumentName>(
  name: N,
  state: Documents[N] | null,
  onLoad: (state: Documents[N]) => void,
  delay = 400,
) {
  const client = useRef(createStorageClient(name));
  const loaded = useRef<Documents[N] | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [recovery, setRecovery] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void client.current.load().then((result) => {
      if (cancelled) return;
      loaded.current = result.state;
      setRecovery(result.recovery);
      setStatus(result.canSave ? "saved" : "memory");
      onLoad(result.state);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      !state ||
      !loaded.current ||
      state === loaded.current ||
      status === "memory" ||
      status === "conflict"
    )
      return;
    const timer = setTimeout(() => {
      setStatus("saving");
      void client.current.save(state).then(setStatus);
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { status, recovery };
}
