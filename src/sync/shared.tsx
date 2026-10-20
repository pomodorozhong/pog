import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

/**
 * The screen state that viewers mirror, by key. The operator's window writes
 * it; a viewer's is replaced by each snapshot from the operator.
 */
export type SharedStore = {
  /** A read-only viewer (`?mode=viewer`), such as an OBS browser source. */
  viewer: boolean;
  /** Whether this window connects to the live relay; off in unit tests. */
  connected: boolean;
  get(key: string): unknown;
  has(key: string): boolean;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  /** All values, for a snapshot. */
  values(): Record<string, unknown>;
  /** A viewer takes the operator's values. Equal values keep their identity. */
  replace(values: Record<string, unknown>): void;
  subscribe(listener: () => void): () => void;
};

export function createSharedStore(
  viewer: boolean,
  connected = true,
): SharedStore {
  let values = new Map<string, unknown>();
  let raw = new Map<string, string>();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());
  return {
    viewer,
    connected,
    get: (key) => values.get(key),
    has: (key) => values.has(key),
    set(key, value) {
      if (values.get(key) === value && values.has(key)) return;
      values.set(key, value);
      changed();
    },
    delete(key) {
      if (values.delete(key)) changed();
    },
    values: () => Object.fromEntries(values),
    replace(next) {
      // Snapshots arrive many times a second while the operator scrolls or
      // pans; unchanged values keep their identity so nothing else redraws.
      const nextValues = new Map<string, unknown>();
      const nextRaw = new Map<string, string>();
      for (const [key, value] of Object.entries(next)) {
        const text = JSON.stringify(value);
        nextRaw.set(key, text);
        nextValues.set(key, raw.get(key) === text ? values.get(key) : value);
      }
      values = nextValues;
      raw = nextRaw;
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const isViewerUrl = (search: string) =>
  new URLSearchParams(search).get("mode") === "viewer";

const SharedContext = createContext<SharedStore>(
  createSharedStore(false, false),
);

export function SharedProvider({
  store,
  children,
}: {
  store: SharedStore;
  children: ReactNode;
}) {
  return (
    <SharedContext.Provider value={store}>{children}</SharedContext.Provider>
  );
}

export const useShared = () => useContext(SharedContext);

/** The operator's value for `key` on a viewer, or `fallback`. */
export function useSharedValue<T>(key: string, fallback: T): T {
  const store = useShared();
  const read = useCallback(
    () => (store.has(key) ? (store.get(key) as T) : fallback),
    [store, key, fallback],
  );
  return useSyncExternalStore(store.subscribe, read, read);
}

/**
 * `useState` for screen state viewers mirror: which modal or menu is open,
 * what is selected, filters. The operator's window works as with `useState`
 * and shares the value under `key`; on a viewer the value is the operator's
 * and setting it does nothing. Values must survive JSON.
 */
export function useSharedState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const store = useShared();
  const [local, setLocal] = useState(initial);
  // The value before the operator's first snapshot, kept stable for the store.
  const [fallback] = useState(local);
  useEffect(() => {
    if (store.viewer) return;
    store.set(key, local);
  }, [store, key, local]);
  useEffect(() => {
    if (store.viewer) return;
    return () => store.delete(key);
  }, [store, key]);
  const remote = useSharedValue(key, fallback);
  const ignore = useCallback(() => {}, []);
  return store.viewer ? [remote, ignore] : [local, setLocal];
}
