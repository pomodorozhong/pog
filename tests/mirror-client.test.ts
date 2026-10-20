import { afterEach, expect, it, vi } from "vitest";
import { createLiveConnection } from "../src/sync/client";
import { liveSnapshot } from "./sync-fixture";

class Socket extends EventTarget {
  readyState = 0;
  bufferedAmount = 0;
  sent: string[] = [];
  send(raw: string) {
    this.sent.push(raw);
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  message(value: unknown) {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(value) }),
    );
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
}
afterEach(() => vi.useRealTimers());

it("coalesces app updates and republishes the latest state after reconnecting", () => {
  vi.useFakeTimers();
  const sockets: Socket[] = [];
  const live = createLiveConnection({
    mirror: false,
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    createSocket: () => {
      const socket = new Socket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  const snapshot = liveSnapshot();
  live.update(snapshot);
  sockets[0].open();
  expect(sockets[0].sent).toHaveLength(1);
  const latest = { ...snapshot, ui: { "app.sheet": "edit" } };
  live.update({ ...snapshot, ui: { "app.tool": "pin" } });
  live.update(latest);
  vi.advanceTimersByTime(50);
  expect(sockets[0].sent.map((raw) => JSON.parse(raw).ui)).toEqual([
    { "app.sheet": "route" },
    { "app.sheet": "edit" },
  ]);
  sockets[0].close();
  vi.advanceTimersByTime(250);
  sockets[1].open();
  expect(JSON.parse(sockets[1].sent[0])).toEqual(latest);
  live.dispose();
  vi.advanceTimersByTime(5000);
  expect(sockets).toHaveLength(2);
});

it("keeps mirrors read-only and ignores invalid frames", () => {
  vi.useFakeTimers();
  const socket = new Socket();
  const receive = vi.fn();
  const live = createLiveConnection({
    mirror: true,
    onMessage: receive,
    onStatus: vi.fn(),
    createSocket: (url) => {
      expect(new URL(url).searchParams.get("mode")).toBe("mirror");
      return socket as unknown as WebSocket;
    },
  });
  socket.open();
  live.update(liveSnapshot());
  vi.advanceTimersByTime(100);
  expect(socket.sent).toEqual([]);
  socket.message({ snapshot: { player: {} }, appConnected: true });
  expect(receive).not.toHaveBeenCalled();
  const message = { snapshot: liveSnapshot(), appConnected: true };
  socket.message(message);
  expect(receive).toHaveBeenCalledWith(message);
  live.dispose();
});
