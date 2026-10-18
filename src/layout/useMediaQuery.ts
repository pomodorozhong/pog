import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches, kept current as the window resizes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

/** Below this width the app shows the map for viewing, without editing. */
export const NARROW = "(max-width: 639px)";

/** Below this width the map tools show as icons with their keys. */
export const COMPACT = "(max-width: 1023px)";
