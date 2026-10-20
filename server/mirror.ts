import type { IncomingMessage } from "node:http";
import type { EventEmitter } from "node:events";
import type { Duplex } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";
import {
  LIVE_SYNC_PATH,
  MAX_SYNC_BYTES,
  type LiveSnapshot,
} from "../src/sync/types.ts";
import { validSnapshot } from "../src/sync/schema.ts";
import { assertLocalRequest } from "./security.ts";

// Each dev or preview server keeps one live session in memory: the app's
// latest snapshot, relayed to mirrors (the OBS browser source). Saves still go
// through FileStore.
export function attachMirrorRelay(server: EventEmitter) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_SYNC_BYTES,
  });
  const mirrors = new Set<WebSocket>();
  const alive = new Set<WebSocket>();
  let snapshot: LiveSnapshot | null = null;
  let app: WebSocket | null = null;
  const message = () =>
    JSON.stringify({
      snapshot,
      appConnected: app?.readyState === WebSocket.OPEN,
    });
  const send = (socket: WebSocket, raw: string) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    // A paused or slow mirror reconnects to the latest state instead of accumulating frames.
    if (socket.bufferedAmount > MAX_SYNC_BYTES) socket.terminate();
    else socket.send(raw);
  };
  const broadcast = () => {
    const raw = message();
    for (const mirror of mirrors) send(mirror, raw);
  };
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== LIVE_SYNC_PATH) return;
    try {
      assertLocalRequest(request);
      const mode = url.searchParams.get("mode");
      if (mode !== "app" && mode !== "mirror") throw new Error("Invalid mode");
      sockets.handleUpgrade(request, socket, head, (connection) => {
        sockets.emit("connection", connection, request);
        alive.add(connection);
        connection.on("error", () => connection.terminate());
        connection.on("pong", () => alive.add(connection));
        if (mode === "mirror") {
          mirrors.add(connection);
          send(connection, message());
        }
        connection.on("message", (bytes, binary) => {
          if (mode === "mirror") {
            connection.close(1008, "Mirrors cannot publish state");
            return;
          }
          try {
            const value: unknown = binary ? null : JSON.parse(bytes.toString());
            if (!validSnapshot(value)) throw new Error("Invalid snapshot");
            snapshot = value;
            app = connection;
            broadcast();
          } catch {
            connection.close(1008, "Invalid live state");
          }
        });
        connection.on("close", () => {
          mirrors.delete(connection);
          alive.delete(connection);
          if (app === connection) {
            app = null;
            broadcast();
          }
        });
      });
    } catch {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  };
  server.on("upgrade", upgrade);
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!alive.delete(socket)) socket.terminate();
      else socket.ping();
    }
  }, 10000);
  heartbeat.unref();
  const dispose = () => {
    clearInterval(heartbeat);
    server.off("upgrade", upgrade);
    server.off("close", dispose);
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  };
  server.once("close", dispose);
  return dispose;
}
