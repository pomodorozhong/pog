import type { PlayerDocument, Profile } from "../domain/types";
import { newId } from "../map/editing";
import greatStars from "../../seed/great-stars-guard-counter.json" with { type: "json" };

/** A ready-made playthrough: what a profile starts with, before any progress. */
export type ProfileTemplate = Omit<Profile, "id" | "progress" | "save">;

/** The "Great Stars Guard Counter" build from the old project. */
export const TEMPLATES = [greatStars as ProfileTemplate];

const emptyProfile: ProfileTemplate = {
  name: "",
  goal: "",
  constraints: "",
  wishlist: [],
};

export const activeProfile = (player: PlayerDocument): Profile =>
  player.profiles.find((p) => p.id === player.activeProfile) ??
  player.profiles[0];

/** Start a new playthrough, empty or from a template, and switch to it. */
export function addProfile(
  player: PlayerDocument,
  template = emptyProfile,
): PlayerDocument {
  const profile: Profile = {
    ...structuredClone(template),
    id: newId("profile"),
    progress: { flags: [], position: null },
    save: null,
  };
  return {
    ...player,
    profiles: [...player.profiles, profile],
    activeProfile: profile.id,
  };
}

export function updateProfile(
  player: PlayerDocument,
  id: string,
  changes: Partial<Omit<Profile, "id">>,
): PlayerDocument {
  return {
    ...player,
    profiles: player.profiles.map((p) =>
      p.id === id ? { ...p, ...changes } : p,
    ),
  };
}

/** Delete a playthrough. The last one stays, since there is always an active profile. */
export function removeProfile(
  player: PlayerDocument,
  id: string,
): PlayerDocument {
  const profiles = player.profiles.filter((p) => p.id !== id);
  if (!profiles.length || profiles.length === player.profiles.length)
    return player;
  return {
    ...player,
    profiles,
    activeProfile:
      player.activeProfile === id ? profiles[0].id : player.activeProfile,
  };
}
