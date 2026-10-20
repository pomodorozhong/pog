# Agent tools

An agent in Claude Code or Claude Desktop can search the item catalog, read the active playthrough's wishlist, and propose wishlist changes. Nothing changes until the player applies a proposal in the app. How it works is in [architecture.md](architecture.md#agent-tools-12).

## What it needs

- **The app open in a browser:** the tools run in the app's window, so `npm run dev` (or `npm run preview`) must be running and the app open. Without it, every tool answers "Path of Grace isn't open" or "isn't running".
- **Node 22.18 or later:** the MCP server runs from source with `node server/mcp.ts`.
- **The address:** the MCP server calls `http://127.0.0.1:5173`, the dev server's usual address. If Vite picks another port (the terminal shows it), or for the preview server (`4173`), set `POG_URL` to that address.

## Claude Code

`.mcp.json` at the repository root adds the `pog` server for Claude Code sessions in this folder. Claude Code asks once before using it. To use another address, add `"env": { "POG_URL": "http://127.0.0.1:5174" }` to the entry.

## Claude Desktop

Add the server to `claude_desktop_config.json` (Settings → Developer → Edit Config), with the repository's absolute path, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "pog": {
      "command": "node",
      "args": ["/absolute/path/to/pog/server/mcp.ts"]
    }
  }
}
```

If Claude Desktop can't find `node`, give its full path (`which node`) as `command`.

## The tools

| Tool                  | Does                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_items`        | Finds catalog items by English or zh-TW name and returns their IDs.                                                                                                   |
| `get_wishlist`        | Lists the wishlist (attached to pins, then not attached), each entry's pin in words, status and note, and the proposals still waiting.                                |
| `add_to_wishlist`     | Proposes adding an item. With `near_grace` (an official grace name in either language, or a grace ID), applying it adds a new pin holding the item beside that grace. |
| `set_item_note`       | Proposes a note for an entry. When the item is at several pins, the agent gives the pin from `get_wishlist`.                                                          |
| `get_proposal_status` | Says whether proposals are waiting, applied or dismissed.                                                                                                             |

## Reviewing proposals

While proposals wait, the header shows **Agent changes** with their count. It opens a list where each one can be applied or dismissed, or all applied at once. A new pin is one undo step. A proposal that went out of date (the entry is already there, or gone, or the active playthrough changed) says why and can only be dismissed.

Proposals live in the app's window: reloading or closing it drops the ones still waiting, and `get_proposal_status` then answers `unknown`. The mirror shows the list while the player reviews it.
