import type { IncomingMessage } from "node:http";
import { StorageError } from "./store.ts";

// Both local-file access and live viewing expose private player data.
export function assertLocalRequest(request: IncomingMessage) {
  const host = request.headers.host;
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      request.socket.remoteAddress ?? "",
    )
  )
    throw new StorageError(403, "Storage is available to local clients only.");
  const hostname = new URL(`http://${host}`).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname))
    throw new StorageError(403, "Storage is available on localhost only.");
  if (
    (request.headers.origin && request.headers.origin !== `http://${host}`) ||
    request.headers["sec-fetch-site"] === "cross-site"
  )
    throw new StorageError(
      403,
      "Cross-origin storage requests are not allowed.",
    );
}
