import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import type { Plugin } from "vite";
import type { DocumentKey } from "../src/domain/types.ts";
import { documentNameOf } from "../src/storage/schema.ts";
import { SaveError, SaveReader } from "./save.ts";
import { attachAgentRelay } from "./agent.ts";
import { attachMirrorRelay } from "./mirror.ts";
import { FileStore, MAX_SAVE_BYTES, StorageError } from "./store.ts";
import { assertLocalRequest } from "./security.ts";

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export function storageMiddleware(store = new FileStore()) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    const match = /^\/api\/state\/(.+)$/.exec(request.url?.split("?")[0] ?? "");
    if (!match) return next();
    try {
      assertLocalRequest(request);
      if (!documentNameOf(match[1]))
        throw new StorageError(404, "Unknown document.");
      const key = match[1] as DocumentKey;
      if (request.method === "GET")
        return reply(response, 200, await store.read(key));
      if (request.method !== "PUT")
        throw new StorageError(405, "Use GET or PUT.");
      if (request.headers["content-type"]?.split(";")[0] !== "application/json")
        throw new StorageError(415, "Use application/json.");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_SAVE_BYTES + 1024)
          throw new StorageError(413, "Saved data exceeds the 4 MiB limit.");
        chunks.push(bytes);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new StorageError(400, "Invalid JSON.");
      }
      if (!body || typeof body !== "object")
        throw new StorageError(400, "Invalid saved state.");
      reply(response, 200, await store.write(key, body.state, body.revision));
    } catch (error) {
      const failure =
        error instanceof StorageError
          ? error
          : new StorageError(503, "Local storage is unavailable.");
      reply(response, failure.status, {
        error: failure.message,
        recovery: failure.recovery,
      });
    }
  };
}

async function readJson(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) throw new SaveError(413, "Request too large.");
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SaveError(400, "Invalid JSON.");
  }
}

// Reads the game's save for the progress import. Read-only: the save is never written.
export function saveMiddleware(reader: SaveReader) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    const url = request.url?.split("?")[0] ?? "";
    if (!url.startsWith("/api/save/")) return next();
    try {
      assertLocalRequest(request);
      const location =
        new URLSearchParams(request.url?.split("?")[1] ?? "").get("location") ||
        null;
      if (url === "/api/save/slots" && request.method === "GET")
        return reply(response, 200, await reader.list(location));
      if (url === "/api/save/stamp" && request.method === "GET")
        return reply(response, 200, { stamp: await reader.stamp(location) });
      if (url === "/api/save/flags" && request.method === "POST") {
        if (
          request.headers["content-type"]?.split(";")[0] !== "application/json"
        )
          throw new SaveError(415, "Use application/json.");
        const body = await readJson(request, 1024 * 1024);
        const chosen = body?.location ?? null;
        if (
          (chosen !== null && typeof chosen !== "string") ||
          typeof body?.steamId !== "string" ||
          !Array.isArray(body.flags) ||
          !body.flags.every(Number.isSafeInteger)
        )
          throw new SaveError(400, "Invalid request.");
        return reply(
          response,
          200,
          await reader.flags(chosen, body.steamId, body.slot, body.flags),
        );
      }
      throw new SaveError(404, "Unknown request.");
    } catch (error) {
      const failure =
        error instanceof SaveError || error instanceof StorageError
          ? error
          : new SaveError(503, "The save cannot be read.");
      reply(response, failure.status, { error: failure.message });
    }
  };
}

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

// Extracted game assets stay out of the build and are served from the local
// game-data folder, to local clients only.
export function gameDataMiddleware(root: string) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    const url = request.url?.split("?")[0] ?? "";
    if (!url.startsWith("/game-data/")) return next();
    const path = normalize(
      join(root, decodeURIComponent(url.slice("/game-data/".length))),
    );
    const type = CONTENT_TYPES[extname(path)];
    try {
      assertLocalRequest(request);
      if (!path.startsWith(root + sep) || !type || !(await stat(path)).isFile())
        throw new Error();
    } catch {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "max-age=3600",
    });
    createReadStream(path).pipe(response);
  };
}

export function localServerPlugin(gameDataRoot: string): Plugin {
  const storage = storageMiddleware();
  const gameData = gameDataMiddleware(gameDataRoot);
  const save = saveMiddleware(
    new SaveReader(join(gameDataRoot, "eventflag_bst.txt")),
  );
  return {
    name: "pog-local-server",
    configureServer(server) {
      server.middlewares.use(storage);
      server.middlewares.use(save);
      server.middlewares.use(gameData);
      if (server.httpServer) {
        attachMirrorRelay(server.httpServer);
        attachAgentRelay(server.httpServer);
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use(storage);
      server.middlewares.use(save);
      server.middlewares.use(gameData);
      attachMirrorRelay(server.httpServer);
      attachAgentRelay(server.httpServer);
    },
  };
}
