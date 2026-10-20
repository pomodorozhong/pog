import type { IncomingMessage } from "node:http";
import type { EventEmitter } from "node:events";
import type { Duplex } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";
import {
  AGENT_PATH,
  AGENT_TIMEOUT_MS,
  MAX_AGENT_BYTES,
  type AgentCall,
  type AgentReply,
} from "../src/agent/tools.ts";
import { assertLocalRequest } from "./security.ts";

export const NO_APP =
  "Path of Grace isn't open. Open it in the browser, then try again.";
export const NO_ANSWER = "Path of Grace didn't answer in time. Try again.";

const parse = (bytes: WebSocket.RawData, binary: boolean): unknown => {
  try {
    return binary ? null : JSON.parse(bytes.toString());
  } catch {
    return null;
  }
};

const validCall = (value: unknown): value is AgentCall =>
  !!value &&
  typeof value === "object" &&
  typeof (value as AgentCall).id === "string" &&
  typeof (value as AgentCall).tool === "string";

const validReply = (value: unknown): value is AgentReply =>
  !!value &&
  typeof value === "object" &&
  typeof (value as AgentReply).id === "string" &&
  ("result" in value ||
    typeof (value as { error?: unknown }).error === "string");

// Passes agents' tool calls to the app's window, which runs them on what it
// shows, and the answers back. The MCP process (`server/mcp.ts`) is an agent
// here. The newest app window gets the calls; mirrors never connect.
export function attachAgentRelay(
  server: EventEmitter,
  timeout = AGENT_TIMEOUT_MS,
) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_AGENT_BYTES,
  });
  let app: WebSocket | null = null;
  let next = 0;
  /** Calls the app hasn't answered, by the relay's own ID. */
  const pending = new Map<
    string,
    { agent: WebSocket; id: string; timer: ReturnType<typeof setTimeout> }
  >();
  const answer = (key: string, reply: Omit<AgentReply, "id">) => {
    const call = pending.get(key);
    if (!call) return;
    pending.delete(key);
    clearTimeout(call.timer);
    if (call.agent.readyState === WebSocket.OPEN)
      call.agent.send(JSON.stringify({ ...reply, id: call.id }));
  };
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== AGENT_PATH) return;
    try {
      assertLocalRequest(request);
      const role = url.searchParams.get("role");
      if (role !== "app" && role !== "agent") throw new Error("Invalid role");
      sockets.handleUpgrade(request, socket, head, (connection) => {
        connection.on("error", () => connection.terminate());
        if (role === "app") {
          app = connection;
          connection.on("message", (bytes, binary) => {
            const reply = parse(bytes, binary);
            if (!validReply(reply)) {
              connection.close(1008, "Invalid reply");
              return;
            }
            if (pending.get(reply.id) && app === connection)
              answer(
                reply.id,
                "error" in reply
                  ? { error: reply.error }
                  : { result: reply.result },
              );
          });
          connection.on("close", () => {
            if (app !== connection) return;
            app = null;
            for (const key of [...pending.keys()])
              answer(key, { error: NO_APP });
          });
          return;
        }
        connection.on("message", (bytes, binary) => {
          const call = parse(bytes, binary);
          if (!validCall(call)) {
            connection.close(1008, "Invalid call");
            return;
          }
          if (app?.readyState !== WebSocket.OPEN) {
            connection.send(JSON.stringify({ id: call.id, error: NO_APP }));
            return;
          }
          const key = `call-${++next}`;
          pending.set(key, {
            agent: connection,
            id: call.id,
            timer: setTimeout(() => answer(key, { error: NO_ANSWER }), timeout),
          });
          app.send(
            JSON.stringify({ id: key, tool: call.tool, args: call.args ?? {} }),
          );
        });
        connection.on("close", () => {
          for (const [key, call] of pending)
            if (call.agent === connection) {
              clearTimeout(call.timer);
              pending.delete(key);
            }
        });
      });
    } catch {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  };
  server.on("upgrade", upgrade);
  const dispose = () => {
    server.off("upgrade", upgrade);
    server.off("close", dispose);
    for (const call of pending.values()) clearTimeout(call.timer);
    pending.clear();
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  };
  server.once("close", dispose);
  return dispose;
}
