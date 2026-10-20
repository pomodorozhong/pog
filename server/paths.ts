import envPaths from "env-paths";
import { isAbsolute, join } from "node:path";
import type { DocumentKey } from "../src/domain/types.ts";

export function resolveStoragePaths(
  override = process.env.POG_DATA_DIR,
  platformPaths: { data: string } = envPaths("pog", { suffix: "" }),
  legacyPaths: { data: string } = envPaths("route-of-grace", { suffix: "" }),
) {
  if (override !== undefined && (!override || !isAbsolute(override)))
    throw new Error("POG_DATA_DIR must be an absolute directory path.");
  const data = override ?? platformPaths.data;
  if (!isAbsolute(data))
    throw new Error(
      "The platform application data directory must be an absolute path.",
    );
  return {
    data,
    /** The data folder from before the project was renamed, moved to `data` once. */
    legacyData: override === undefined ? legacyPaths.data : null,
    /** Keys are checked by `documentNameOf` first, so they stay inside `data`. */
    document: (key: DocumentKey) => join(data, `${key}.json`),
    /** The single map saved before each profile had its own. */
    legacyMap: join(data, "map.json"),
    /** Maps of deleted profiles, kept since they are player data. */
    deletedMaps: join(data, "deleted", "maps"),
  };
}
