import { validMirrorMessage } from "./schema";
import {
  LIVE_SYNC_PATH,
  MAX_SYNC_BYTES,
  type LiveSnapshot,
  type SyncStatus,
  type MirrorMessage,
} from "./types";

type Options = {
  mirror: boolean;
  onMessage: (message: MirrorMessage) => void;
  onStatus: (status: SyncStatus) => void;
  createSocket?: (url: string) => WebSocket;
};

// The app publishes snapshots; a mirror never sends even an initial save.
export function createLiveConnection({
  mirror,
  onMessage,
  onStatus,
  createSocket = (url) => new WebSocket(url),
}: Options) {
  const url = new URL(LIVE_SYNC_PATH, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("mode", mirror ? "mirror" : "app");
  let socket: WebSocket | null = null;
  let latest: LiveSnapshot | null = null;
  let dirty = false;
  let disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 250;

  const flush = () => {
    clearTimeout(pending);
    pending = undefined;
    if (mirror || disposed || !dirty || !latest || socket?.readyState !== 1)
      return;
    if (socket.bufferedAmount > MAX_SYNC_BYTES) {
      pending = setTimeout(flush, 50);
      return;
    }
    try {
      socket.send(JSON.stringify(latest));
      dirty = false;
    } catch {
      socket.close();
    }
  };
  const schedule = () => {
    if (!pending && !disposed) pending = setTimeout(flush, 50);
  };
  const reconnect = () => {
    if (disposed || retry) return;
    onStatus("disconnected");
    if (!navigator.onLine) return;
    retry = setTimeout(() => {
      retry = undefined;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 4000);
  };
  const connect = () => {
    if (disposed) return;
    if (!navigator.onLine) {
      onStatus("disconnected");
      return;
    }
    onStatus("connecting");
    let connection: WebSocket;
    try {
      connection = createSocket(url.href);
    } catch {
      reconnect();
      return;
    }
    socket = connection;
    connection.addEventListener("open", () => {
      if (disposed || socket !== connection) return;
      retryDelay = 250;
      onStatus("connected");
      dirty = Boolean(latest);
      flush();
    });
    connection.addEventListener("message", (event) => {
      if (!mirror || disposed || socket !== connection) return;
      try {
        const value: unknown = JSON.parse(String(event.data));
        if (validMirrorMessage(value)) onMessage(value);
      } catch {
        // An incomplete or invalid frame never replaces the last valid display.
      }
    });
    connection.addEventListener("close", () => {
      if (!disposed && socket === connection) reconnect();
    });
    connection.addEventListener("error", () => connection.close());
  };
  const resume = () => {
    if (document.visibilityState === "hidden" || !navigator.onLine) return;
    if (socket?.readyState === 1) {
      if (!mirror) {
        dirty = Boolean(latest);
        flush();
      }
      // Reopening obtains a complete snapshot, including updates missed while frozen.
      else socket.close();
    } else if (!socket || socket.readyState === 3) {
      clearTimeout(retry);
      retry = undefined;
      connect();
    }
  };
  const offline = () => {
    clearTimeout(retry);
    retry = undefined;
    onStatus("disconnected");
    socket?.close();
  };
  window.addEventListener("pageshow", resume);
  window.addEventListener("online", resume);
  window.addEventListener("offline", offline);
  document.addEventListener("visibilitychange", resume);
  connect();
  return {
    update(snapshot: LiveSnapshot) {
      if (mirror || disposed) return;
      latest = snapshot;
      dirty = true;
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(retry);
      clearTimeout(pending);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", resume);
      socket?.close();
    },
  };
}
