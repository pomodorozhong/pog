import { useEffect, useLayoutEffect, useRef } from "react";
import { createLiveConnection } from "./client";
import { captureScrolling, followScrolling, shareScrolling } from "./scroll";
import type { SharedStore } from "./shared";
import type { LiveSnapshot } from "./types";

type Documents = Omit<LiveSnapshot, "ui">;

/**
 * The app's window publishes what it shows whenever the documents or the
 * shared screen state change; the connection batches them.
 */
export function useAppSync(store: SharedStore, documents: Documents | null) {
  const latest = useRef(documents);
  const connection = useRef<ReturnType<typeof createLiveConnection>>(null);
  const publish = useRef(() => {
    if (latest.current)
      connection.current?.update({ ...latest.current, ui: store.values() });
  });
  useEffect(() => {
    if (store.mirror || !store.connected) return;
    const live = createLiveConnection({
      mirror: false,
      onMessage() {},
      onStatus() {},
    });
    connection.current = live;
    const send = publish.current;
    const stopListening = store.subscribe(send);
    const stopScrolling = shareScrolling(store);
    send();
    return () => {
      stopListening();
      stopScrolling();
      live.dispose();
      connection.current = null;
    };
  }, [store]);
  useEffect(() => {
    latest.current = documents;
    publish.current();
  }, [documents]);
  // A render can open, close or refill a panel without a scroll event.
  useLayoutEffect(() => {
    if (!store.mirror) captureScrolling(store);
  });
}

/**
 * A mirror follows the app's snapshots. Until the first one arrives it
 * shows the saved documents; when the app's window closes it keeps the
 * last one. The connection state is on `<html data-live>` for tests.
 */
export function useMirrorSync(
  store: SharedStore,
  onSnapshot: (snapshot: LiveSnapshot) => void,
) {
  const handler = useRef(onSnapshot);
  useLayoutEffect(() => {
    handler.current = onSnapshot;
  });
  useEffect(() => {
    if (!store.mirror || !store.connected) return;
    const root = document.documentElement;
    const live = createLiveConnection({
      mirror: true,
      onMessage(message) {
        root.dataset.app = message.appConnected ? "on" : "off";
        if (!message.snapshot) return;
        store.replace(message.snapshot.ui);
        handler.current(message.snapshot);
        // A scroll alone rerenders nothing; follow it once React has drawn.
        requestAnimationFrame(() => followScrolling(store));
      },
      onStatus(status) {
        root.dataset.live = status;
      },
    });
    // Panels change size with the mirror's own window and as images load.
    const resize = new ResizeObserver(() => followScrolling(store));
    resize.observe(root);
    return () => {
      resize.disconnect();
      live.dispose();
    };
  }, [store]);
  // Every snapshot rerenders; panels follow once the new content is laid out.
  useLayoutEffect(() => {
    if (store.mirror) followScrolling(store);
  });
}
