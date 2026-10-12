import { useMemo } from "react";
import type { MapDocument, Profile } from "../domain/types";
import type { GameData } from "../map/catalog";
import { discoveredGraces } from "../progress/progress";
import { planRoute, travelTimes, wishlistTargets } from "./order";
import { buildGraph } from "./route";

/**
 * The active playthrough's route: from its position to every needed wishlist
 * item with a pin. Null until a position is set.
 */
export function usePlannedRoute(
  data: GameData | null,
  map: MapDocument,
  profile: Profile | null,
) {
  return useMemo(() => {
    const start = profile?.progress.position;
    if (!data || !profile || !start || !map.nodes.some((n) => n.id === start))
      return null;
    const graph = buildGraph(
      map,
      profile.rules,
      discoveredGraces(data, map.nodes, profile.progress),
    );
    const times = travelTimes(graph);
    const targets = wishlistTargets(map, profile.wishlist);
    const route = planRoute(
      times,
      start,
      targets.map((t) => t.node),
    );
    return { start, times, targets, route };
  }, [data, map, profile]);
}

export type RoutePlan = NonNullable<ReturnType<typeof usePlannedRoute>>;
