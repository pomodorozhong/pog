// The MCP server agents start (Claude Code, Claude Desktop): `node server/mcp.ts`.
// It lists the wishlist tools and passes each call to the open app through
// the dev or preview server's relay (`server/agent.ts`). Standard output is
// the MCP connection, so nothing else may print to it.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import {
  AGENT_PATH,
  AGENT_TIMEOUT_MS,
  AGENT_TOOLS,
  type AgentReply,
} from "../src/agent/tools.ts";

const NOT_RUNNING = (url: string) =>
  `Path of Grace isn't running at ${url}. Start it with \`npm run dev\` and open it in the browser, or set POG_URL to its address.`;

/** Call a tool in the open app; resolves with its result or rejects with a message for the agent. */
export function callApp(
  appUrl: string,
  tool: string,
  args: unknown,
  timeout = AGENT_TIMEOUT_MS + 5_000,
): Promise<unknown> {
  const url = new URL(AGENT_PATH, appUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("role", "agent");
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const socket = new WebSocket(url);
    const fail = (message: string) => {
      clearTimeout(timer);
      socket.terminate();
      reject(new Error(message));
    };
    const timer = setTimeout(
      () => fail("Path of Grace didn't answer in time. Try again."),
      timeout,
    );
    socket.on("open", () => socket.send(JSON.stringify({ id, tool, args })));
    socket.on("message", (bytes) => {
      let reply: AgentReply;
      try {
        reply = JSON.parse(bytes.toString());
      } catch {
        return;
      }
      if (reply.id !== id) return;
      clearTimeout(timer);
      socket.close();
      if ("error" in reply) reject(new Error(reply.error));
      else resolve(reply.result);
    });
    socket.on("error", () => fail(NOT_RUNNING(appUrl)));
  });
}

export function createMcpServer(appUrl: string) {
  const server = new Server(
    { name: "pog", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: AGENT_TOOLS,
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    if (!AGENT_TOOLS.some((tool) => tool.name === name))
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool "${name}".` }],
      };
    try {
      const result = await callApp(appUrl, name, args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 1) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: (error as Error).message }],
      };
    }
  });
  return server;
}

if (import.meta.main) {
  const appUrl = process.env.POG_URL || "http://127.0.0.1:5173";
  await createMcpServer(appUrl).connect(new StdioServerTransport());
}
