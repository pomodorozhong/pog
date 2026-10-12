import envPaths from "env-paths";
import { isAbsolute, join } from "node:path";
import type { DocumentKey } from "../src/domain/types.ts";

export function resolveStoragePaths(
  override = process.env.ROUTE_OF_GRACE_DATA_DIR,
  platformPaths = envPaths("route-of-grace", { suffix: "" }),
) {
  if (override !== undefined && (!override || !isAbsolute(override)))
    throw new Error(
      "ROUTE_OF_GRACE_DATA_DIR must be an absolute directory path.",
    );
  const data = override ?? platformPaths.data;
  if (!isAbsolute(data))
    throw new Error(
      "The platform application data directory must be an absolute path.",
    );
  return {
    data,
    /** Keys are checked by `documentNameOf` first, so they stay inside `data`. */
    document: (key: DocumentKey) => join(data, `${key}.json`),
    /** The single map saved before each profile had its own. */
    legacyMap: join(data, "map.json"),
    /** Maps of deleted profiles, kept since they are player data. */
    deletedMaps: join(data, "deleted", "maps"),
  };
}
