import type {
  Language,
  MapDocument,
  PlayerDocument,
  Progress,
  SaveLink,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import type { GameData } from "../map/catalog";

export type SaveSlot = { index: number; name: string };
/** A save file the server found, with its account and characters. */
export type SaveSummary = { steamId: string; slots: SaveSlot[]; file: string };
/** The saves found, and every place looked at. */
export type SaveSearch = { saves: SaveSummary[]; searched: string[] };
export type SlotFlags = { name: string; set: number[] };

/** A failed save request, with the server's status (409: the game was writing). */
export class SaveRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new SaveRequestError(
      response.status,
      body.error ?? `The save cannot be read (${response.status}).`,
    );
  return body as T;
}

/**
 * The saves at a location (a save file or a folder), or, with none, wherever
 * the game keeps them on this Mac.
 */
export const fetchSaves = (location: string | null) =>
  call<SaveSearch>(
    location === null
      ? "/api/save/slots"
      : `/api/save/slots?${new URLSearchParams({ location })}`,
  );

/** When the saves at a location last changed, without reading them. */
export const fetchSaveStamp = (location: string | null) =>
  call<{ stamp: string }>(
    location === null
      ? "/api/save/stamp"
      : `/api/save/stamp?${new URLSearchParams({ location })}`,
  ).then((r) => r.stamp);

/**
 * What an import asks the save about: every grace, and the bosses at the
 * map's pins and graces (`doc` with its game graces), with their names.
 * Bosses that share a flag share one name, joined.
 */
export function importFlags(
  data: GameData,
  doc: MapDocument,
  language: Language,
) {
  const onMap = new Set(doc.nodes.flatMap((n) => n.bosses ?? []));
  const bossName = new Map<number, string>();
  for (const b of data.catalog.bosses.filter((b) => onMap.has(b.id)))
    bossName.set(
      b.flag,
      [bossName.get(b.flag), b.name[language]].filter(Boolean).join(" / "),
    );
  const graceName = new Map(
    data.catalog.graces.map((g) => [g.flag, g.name[language]]),
  );
  return {
    known: [...new Set([...graceName.keys(), ...bossName.keys()])],
    isBoss: (flag: number) => !graceName.has(flag) && bossName.has(flag),
    bossName,
    graceName,
  };
}

/** "+1 graces discovered, −0 not discovered · +2 bosses beaten, −0 not beaten" */
export function summarizeImport(
  t: Translate,
  plan: ImportPlan,
  isBoss: (flag: number) => boolean,
) {
  const count = (flags: number[], bosses: boolean) =>
    flags.filter((f) => isBoss(f) === bosses).length;
  return (
    [
      [false, "+{added} graces discovered, −{removed} not discovered"],
      [true, "+{added} bosses beaten, −{removed} not beaten"],
    ] as const
  )
    .map(([bosses, text]) => ({
      text,
      added: count(plan.added, bosses),
      removed: count(plan.removed, bosses),
    }))
    .filter((part) => part.added + part.removed > 0)
    .map(({ text, ...counts }) => t(text, counts))
    .join(" · ");
}

/**
 * The automatic import's short note, without the parts that are zero:
 * "+1 graces discovered · 1 bosses no longer beaten".
 */
export function summarizeChanges(
  t: Translate,
  plan: ImportPlan,
  isBoss: (flag: number) => boolean,
) {
  const count = (flags: number[], bosses: boolean) =>
    flags.filter((f) => isBoss(f) === bosses).length;
  return (
    [
      [plan.added, false, "+{count} graces discovered"],
      [plan.removed, false, "{count} graces no longer discovered"],
      [plan.added, true, "+{count} bosses beaten"],
      [plan.removed, true, "{count} bosses no longer beaten"],
    ] as const
  )
    .map(([flags, bosses, text]) => ({ text, count: count(flags, bosses) }))
    .filter((part) => part.count > 0)
    .map(({ text, count }) => t(text, { count }))
    .join(" · ");
}

/** Which of `flags` are set for the linked character, in the save at `location`. */
export const fetchSlotFlags = (
  location: string | null,
  link: Omit<SaveLink, "name">,
  flags: number[],
) =>
  call<SlotFlags>("/api/save/flags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location,
      steamId: link.steamId,
      slot: link.slot,
      flags,
    }),
  });

export type ImportPlan = {
  /** Flags the save has set that progress doesn't. */
  added: number[];
  /** Flags progress has that the save doesn't: marked by hand, or reset. */
  removed: number[];
  flags: number[];
};

/**
 * The save is the truth for every flag it was asked about (`known`); flags
 * it wasn't asked about stay as they are.
 */
export function planImport(
  progress: Progress,
  known: number[],
  set: number[],
): ImportPlan {
  const before = new Set(progress.flags);
  const inSave = new Set(set);
  const added = set.filter((f) => !before.has(f));
  const removed = known.filter((f) => before.has(f) && !inSave.has(f));
  const knownSet = new Set(known);
  const flags = [
    ...progress.flags.filter((f) => !knownSet.has(f)),
    ...set,
  ].sort((a, b) => a - b);
  return {
    added,
    removed,
    flags: flags.filter((f, i) => i === 0 || f !== flags[i - 1]),
  };
}

/**
 * Apply an import to a profile and remember which character it came from,
 * and where its save is.
 */
export const applyImport = (
  player: PlayerDocument,
  profileId: string,
  plan: ImportPlan,
  link: SaveLink,
  location: string | null,
): PlayerDocument => ({
  ...player,
  saveLocation: location,
  profiles: player.profiles.map((p) =>
    p.id === profileId
      ? { ...p, progress: { ...p.progress, flags: plan.flags }, save: link }
      : p,
  ),
});
