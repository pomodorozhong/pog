import type { MapNode, PlayerDocument, Progress } from "../domain/types";
import type { GameData } from "../map/catalog";
import { graceTwins } from "../map/graces";

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

const twinFlagCache = new WeakMap<GameData, Map<string, number[]>>();

/** The "discovered" flags of the twins hidden behind each shown grace, by its id. */
function twinFlags(data: GameData): Map<string, number[]> {
  let flags = twinFlagCache.get(data);
  if (!flags) {
    const { twins } = graceTwins(data.catalog.graces);
    flags = new Map(
      [...twins].map(([id, hidden]) => [id, hidden.map((g) => g.flag)]),
    );
    twinFlagCache.set(data, flags);
  }
  return flags;
}

/**
 * Every flag that marks a node's game grace discovered: its own, and its
 * hidden twin's. After Leyndell burns, only the Ashen Capital twins' flags
 * get set. Empty for a node that isn't a game grace.
 */
export function discoveryFlags(data: GameData, node: MapNode): number[] {
  const flag = graceFlag(data, node);
  if (flag === undefined) return [];
  return [flag, ...(twinFlags(data).get(node.ref!) ?? [])];
}

/** Whether a node is a game grace discovered in this progress, by itself or its twin. */
export const isDiscovered = (
  data: GameData,
  node: MapNode,
  flags: Set<number>,
) => discoveryFlags(data, node).some((f) => flags.has(f));

/**
 * Mark a game grace discovered (its own flag) or not (its twins' flags too,
 * so it reads as undiscovered).
 */
export const setDiscovered = (
  player: PlayerDocument,
  profileId: string,
  data: GameData,
  node: MapNode,
  on: boolean,
): PlayerDocument => {
  const [own, ...twins] = discoveryFlags(data, node);
  if (own === undefined) return player;
  if (on) return setFlag(player, profileId, own, true);
  return [own, ...twins].reduce(
    (p, flag) => setFlag(p, profileId, flag, false),
    player,
  );
};

/** Graces on the map that this progress hasn't discovered yet. */
export function undiscoveredGraces(
  data: GameData,
  nodes: MapNode[],
  progress: Progress,
): Set<string> {
  const flags = new Set(progress.flags);
  return new Set(
    nodes
      .filter((n) => graceFlag(data, n) !== undefined)
      .filter((n) => !isDiscovered(data, n, flags))
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
  return nodes.filter((n) => isDiscovered(data, n, flags)).map((n) => n.id);
}

/** How many of the game's graces this progress has discovered. */
export function discoveredCount(data: GameData, progress: Progress) {
  const flags = new Set(progress.flags);
  return data.catalog.graces.filter((g) => flags.has(g.flag)).length;
}

/** Catalog ids of the bosses whose "beaten" flag is set in this progress. */
export function beatenBosses(
  data: GameData,
  progress: Progress | null,
): Set<string> {
  const flags = new Set(progress?.flags);
  return new Set(
    data.catalog.bosses.filter((b) => flags.has(b.flag)).map((b) => b.id),
  );
}
