import { FIRST_PROFILE_ID, initialDocuments } from "../src/storage/schema";
import type { LiveSnapshot } from "../src/sync/types";

export function liveSnapshot(): LiveSnapshot {
  const { player, map } = initialDocuments();
  return {
    player,
    map,
    mapProfile: FIRST_PROFILE_ID,
    saveStatus: ["saved", "saved"],
    ui: { "app.sheet": "route" },
  };
}
