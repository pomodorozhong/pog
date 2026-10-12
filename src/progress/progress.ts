import type { MapNode, PlayerDocument, Progress } from "../domain/types";
import type { GameData } from "../map/catalog";

function changeProgress(
  player: PlayerDocument,
  profileId: string,
  change: (progress: Progress) => Progress,
): PlayerDocument {
  return {
    ...player,
    profiles: player.profiles.map((p) =>
      p.id === profileId ? { ...p, progress: change(p.progress) } : p,
    ),
  };
}

/** Set or clear one event flag, keeping the list sorted. */
export const setFlag = (
  player: PlayerDocument,
  profileId: string,
  flag: number,
  on: boolean,
): PlayerDocument =>
  changeProgress(player, profileId, (progress) => {
    const flags = new Set(progress.flags);
    if (on) flags.add(flag);
    else flags.delete(flag);
    return { ...progress, flags: [...flags].sort((a, b) => a - b) };
  });

export const setPosition = (
  player: PlayerDocument,
  profileId: string,
  position: string | null,
): PlayerDocument =>
  changeProgress(player, profileId, (progress) => ({ ...progress, position }));

/** The "discovered" flag of the game grace a node is linked to, if any. */
export function graceFlag(data: GameData, node: MapNode): number | undefined {
  if (node.kind !== "grace" || !node.ref) return undefined;
  return data.graceFlags.get(node.ref);
}

/** Graces on the map whose game flag isn't set yet in this progress. */
export function undiscoveredGraces(
  data: GameData,
  nodes: MapNode[],
  progress: Progress,
): Set<string> {
  const flags = new Set(progress.flags);
  return new Set(
    nodes
      .filter((n) => {
        const flag = graceFlag(data, n);
        return flag !== undefined && !flags.has(flag);
      })
      .map((n) => n.id),
  );
}

/** Graces on the map that this progress has discovered: fast travel targets. */
export function discoveredGraces(
  data: GameData,
  nodes: MapNode[],
  progress: Progress,
): string[] {
  const flags = new Set(progress.flags);
  return nodes
    .filter((n) => {
      const flag = graceFlag(data, n);
      return flag !== undefined && flags.has(flag);
    })
    .map((n) => n.id);
}

/** How many of the game's graces this progress has discovered. */
export function discoveredCount(data: GameData, progress: Progress) {
  const flags = new Set(progress.flags);
  return data.catalog.graces.filter((g) => flags.has(g.flag)).length;
}
