// What agents can call, as plain data: the MCP process (`server/mcp.ts`) lists
// these, and the app's window runs them (`src/agent/run.ts`). Imports nothing,
// so Node can run the MCP process from source.

export const AGENT_PATH = "/api/agent";
/** Tool calls and results are small; a whole wishlist fits many times over. */
export const MAX_AGENT_BYTES = 1024 * 1024;
/** How long the relay waits for the app's window to answer a call. */
export const AGENT_TIMEOUT_MS = 15_000;

/** A call the relay passes to the app's window. */
export type AgentCall = { id: string; tool: string; args: unknown };
/** The window's answer: a result, or an error the agent reads. */
export type AgentReply =
  { id: string; result: unknown } | { id: string; error: string };

export type AgentTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

const pin = {
  type: ["string", "null"],
  description:
    "The pin ID from get_wishlist, or null for the entry not attached to a pin.",
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "search_items",
    description:
      "Find Elden Ring items in the game's catalog by English or Traditional Chinese name. Use it to get the item ID the other tools need.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of the item's name." },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          description: "At most this many matches (default 10).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_wishlist",
    description:
      "List the active playthrough's wishlist: each entry's item, pin, status (needed, acquired or skipped) and note, and the proposals still waiting for the player's review.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "add_to_wishlist",
    description:
      "Propose adding an item to the active playthrough's wishlist. The player reviews the proposal in the app before anything changes. Without near_grace the entry isn't attached to a pin; with it, a new pin holding the item is placed beside that Site of Grace.",
    inputSchema: {
      type: "object",
      properties: {
        item: {
          type: "string",
          description: 'Item ID from search_items, such as "weapon/2010000".',
        },
        note: { type: "string", description: "A note for the entry." },
        near_grace: {
          type: "string",
          description:
            'The Site of Grace nearest the item, by its official English or Traditional Chinese name, or its grace ID ("grace/…").',
        },
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    name: "set_item_note",
    description:
      "Propose adding or replacing the note on a wishlist entry. The player reviews it in the app. When the item has entries at several pins, give the pin.",
    inputSchema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Item ID." },
        note: { type: "string", description: "The new note; empty clears it." },
        pin,
      },
      required: ["item", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "get_proposal_status",
    description:
      "Whether proposals are still waiting, applied or dismissed by the player. 'unknown' means the app reloaded since, which drops proposals still waiting, or the ID is wrong.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description:
            "Proposal IDs returned by add_to_wishlist or set_item_note.",
        },
      },
      required: ["ids"],
      additionalProperties: false,
    },
  },
];
