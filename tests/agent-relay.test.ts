// @vitest-environment node
import { afterEach, beforeEach, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { NO_ANSWER, NO_APP, attachAgentRelay } from "../server/agent";
import { callApp } from "../server/mcp";

let server: Server;
let dispose: () => void;
let base: string;
const clients: WebSocket[] = [];
beforeEach(async () => {
  server = createServer((_request, response) => response.writeHead(404).end());
  dispose = attachAgentRelay(server, 200);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  for (const client of clients.splice(0)) client.terminate();
  dispose();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** An app window answering every call with `answer`. */
async function app(answer: (call: { tool: string; args: unknown }) => object) {
  const socket = new WebSocket(
    `${base.replace("http", "ws")}/api/agent?role=app`,
  );
  clients.push(socket);
  socket.on("message", (raw) => {
    const call = JSON.parse(raw.toString());
    const reply = answer(call);
    if (reply) socket.send(JSON.stringify({ ...reply, id: call.id }));
  });
  await new Promise((resolve) => socket.once("open", resolve));
  return socket;
}

it("passes a call to the app's window and its result back", async () => {
  await app(({ tool, args }) => ({ result: { tool, args } }));
  expect(await callApp(base, "get_wishlist", { a: 1 })).toEqual({
    tool: "get_wishlist",
    args: { a: 1 },
  });
});

it("passes the app's error back", async () => {
  await app(() => ({ error: "No such item." }));
  await expect(callApp(base, "set_item_note", {})).rejects.toThrow(
    "No such item.",
  );
});

it("sends calls to the newest app window", async () => {
  await app(() => ({ result: "old" }));
  await app(() => ({ result: "new" }));
  expect(await callApp(base, "get_wishlist", {})).toBe("new");
});

it("says so when no app window is open, or it doesn't answer", async () => {
  await expect(callApp(base, "get_wishlist", {})).rejects.toThrow(NO_APP);
  await app(() => null as unknown as object);
  await expect(callApp(base, "get_wishlist", {})).rejects.toThrow(NO_ANSWER);
});

it("fails calls waiting on an app window that closes", async () => {
  const socket = await app(() => {
    socket.close();
    return null as unknown as object;
  });
  await expect(callApp(base, "get_wishlist", {})).rejects.toThrow(NO_APP);
});

it("says the app isn't running when nothing listens", async () => {
  await expect(
    callApp("http://127.0.0.1:1", "get_wishlist", {}),
  ).rejects.toThrow("isn't running");
});

it("refuses connections from another site", async () => {
  const socket = new WebSocket(
    `${base.replace("http", "ws")}/api/agent?role=agent`,
    { origin: "https://example.com" },
  );
  clients.push(socket);
  const failed = await new Promise<boolean>((resolve) => {
    socket.on("open", () => resolve(false));
    socket.on("error", () => resolve(true));
  });
  expect(failed).toBe(true);
});
