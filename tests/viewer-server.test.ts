// @vitest-environment node
import { afterEach, beforeEach, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { attachViewerRelay } from "../server/viewer";
import type { ViewerMessage } from "../src/sync/types";
import { liveSnapshot } from "./sync-fixture";

let server: Server;
let dispose: () => void;
let url: string;
const clients: WebSocket[] = [];
beforeEach(async () => {
  server = createServer((_request, response) => response.writeHead(404).end());
  dispose = attachViewerRelay(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `ws://127.0.0.1:${(server.address() as { port: number }).port}/api/viewer`;
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
  new Promise<ViewerMessage>((resolve) =>
    socket.once("message", (raw) => resolve(JSON.parse(raw.toString()))),
  );
const closed = (socket: WebSocket) =>
  new Promise<number>((resolve) => socket.once("close", resolve));

it("sends initial snapshots, fans out updates within one second, and retains the last display after disconnect", async () => {
  const viewer = connect("viewer");
  const empty = next(viewer);
  await opened(viewer);
  expect(await empty).toEqual({ snapshot: null, operatorConnected: false });
  const operator = connect("operator");
  await opened(operator);
  const snapshot = liveSnapshot();
  snapshot.ui["app.sheet"] = "edit";
  const update = next(viewer);
  const started = performance.now();
  operator.send(JSON.stringify(snapshot));
  expect(await update).toEqual({ snapshot, operatorConnected: true });
  expect(performance.now() - started).toBeLessThan(1000);
  const other = connect("viewer");
  const initial = next(other);
  await opened(other);
  expect(await initial).toEqual({ snapshot, operatorConnected: true });
  const end = next(viewer);
  operator.close();
  expect(await end).toEqual({ snapshot, operatorConnected: false });
  const replacement = connect("operator");
  await opened(replacement);
  const following = next(viewer);
  const latest = liveSnapshot();
  latest.player.language = "zh-TW";
  replacement.send(JSON.stringify(latest));
  expect(await following).toEqual({
    snapshot: latest,
    operatorConnected: true,
  });
});

it("rejects viewer publication without replacing the operator's snapshot", async () => {
  const operator = connect("operator");
  await opened(operator);
  const viewer = connect("viewer");
  const initial = next(viewer);
  await opened(viewer);
  await initial;
  const snapshot = liveSnapshot();
  const update = next(viewer);
  operator.send(JSON.stringify(snapshot));
  await update;
  const rejected = closed(viewer);
  viewer.send(JSON.stringify({ ...snapshot, mapProfile: "unauthorized" }));
  expect(await rejected).toBe(1008);
  const fresh = connect("viewer");
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
    const operator = connect("operator");
    await opened(operator);
    const rejected = closed(operator);
    operator.send(invalid);
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
      `${url}?mode=${Object.keys(options).length ? "viewer" : "invalid"}`,
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
