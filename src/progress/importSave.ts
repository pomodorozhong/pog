import type { PlayerDocument, Progress, SaveLink } from "../domain/types";

export type SaveSlot = { index: number; name: string };
export type SaveSummary = { steamId: string; slots: SaveSlot[] };
export type SlotFlags = { name: string; set: number[] };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.error ?? `The save cannot be read (${response.status}).`,
    );
  return body as T;
}

/** The characters in each Steam account's save. */
export const fetchSaves = () =>
  call<{ saves: SaveSummary[] }>("/api/save/slots").then((r) => r.saves);

/** Which of `flags` are set for the linked character. */
export const fetchSlotFlags = (link: Omit<SaveLink, "name">, flags: number[]) =>
  call<SlotFlags>("/api/save/flags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steamId: link.steamId, slot: link.slot, flags }),
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

/** Apply an import to a profile and remember which character it came from. */
export const applyImport = (
  player: PlayerDocument,
  profileId: string,
  plan: ImportPlan,
  link: SaveLink,
): PlayerDocument => ({
  ...player,
  profiles: player.profiles.map((p) =>
    p.id === profileId
      ? { ...p, progress: { ...p.progress, flags: plan.flags }, save: link }
      : p,
  ),
});
