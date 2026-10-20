// @vitest-environment node
import { afterEach, beforeEach, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { attachMirrorRelay } from "../server/mirror";
import type { MirrorMessage } from "../src/sync/types";
import { liveSnapshot } from "./sync-fixture";

let server: Server;
let dispose: () => void;
let url: string;
const clients: WebSocket[] = [];
beforeEach(async () => {
  server = createServer((_request, response) => response.writeHead(404).end());
  dispose = attachMirrorRelay(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/api/mirror`;
});
afterEach(async () => {
  for (const client of clients.splice(0)) client.terminate();
  dispose();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
function connect(mode: string, origin?: string) {
  const socket = new WebSocket(
    `${url}?mode=${mode}`,
    origin ? { origin } : undefined,
  );
  socket.on("error", () => {});
  clients.push(socket);
  return socket;
}
const opened = (socket: WebSocket) =>
  new Promise<void>((resolve) => socket.once("open", resolve));
const next = (socket: WebSocket) =>
  new Promise<MirrorMessage>((resolve) =>
    socket.once("message", (raw) => resolve(JSON.parse(raw.toString()))),
  );
const closed = (socket: WebSocket) =>
  new Promise<number>((resolve) => socket.once("close", resolve));

it("sends initial snapshots, fans out updates within one second, and retains the last display after disconnect", async () => {
  const mirror = connect("mirror");
  const empty = next(mirror);
  await opened(mirror);
  expect(await empty).toEqual({ snapshot: null, appConnected: false });
  const app = connect("app");
  await opened(app);
  const snapshot = liveSnapshot();
  snapshot.ui["app.sheet"] = "edit";
  const update = next(mirror);
  const started = performance.now();
  app.send(JSON.stringify(snapshot));
  expect(await update).toEqual({ snapshot, appConnected: true });
  expect(performance.now() - started).toBeLessThan(1000);
  const other = connect("mirror");
  const initial = next(other);
  await opened(other);
  expect(await initial).toEqual({ snapshot, appConnected: true });
  const end = next(mirror);
  app.close();
  expect(await end).toEqual({ snapshot, appConnected: false });
  const replacement = connect("app");
  await opened(replacement);
  const following = next(mirror);
  const latest = liveSnapshot();
  latest.player.language = "zh-TW";
  replacement.send(JSON.stringify(latest));
  expect(await following).toEqual({
    snapshot: latest,
    appConnected: true,
  });
});

it("rejects mirror publication without replacing the app's snapshot", async () => {
  const app = connect("app");
  await opened(app);
  const mirror = connect("mirror");
  const initial = next(mirror);
  await opened(mirror);
  await initial;
  const snapshot = liveSnapshot();
  const update = next(mirror);
  app.send(JSON.stringify(snapshot));
  await update;
  const rejected = closed(mirror);
  mirror.send(JSON.stringify({ ...snapshot, mapProfile: "unauthorized" }));
  expect(await rejected).toBe(1008);
  const fresh = connect("mirror");
  const saved = next(fresh);
  await opened(fresh);
  expect((await saved).snapshot).toEqual(snapshot);
});

it("validates incoming snapshots", async () => {
  for (const invalid of [
    "broken JSON",
    JSON.stringify({ ...liveSnapshot(), player: { schemaVersion: 99 } }),
    JSON.stringify({ ...liveSnapshot(), mapProfile: "no such profile" }),
    JSON.stringify({ ...liveSnapshot(), saveStatus: ["unknown"] }),
    JSON.stringify({ ...liveSnapshot(), ui: [] }),
  ]) {
    const app = connect("app");
    await opened(app);
    const rejected = closed(app);
    app.send(invalid);
    expect(await rejected).toBe(1008);
  }
});

it("rejects cross-origin connections, rebinding hosts and unknown modes", async () => {
  for (const options of [
    { origin: "https://example.com" },
    { headers: { Host: "example.com" } },
    {},
  ]) {
    const socket = new WebSocket(
      `${url}?mode=${Object.keys(options).length ? "mirror" : "invalid"}`,
      options,
    );
    socket.on("error", () => {});
    clients.push(socket);
    const status = new Promise<number | undefined>((resolve) =>
      socket.once("unexpected-response", (_request, response) => {
        response.resume();
        resolve(response.statusCode);
        socket.terminate();
      }),
    );
    expect(await status).toBe(403);
  }
});
