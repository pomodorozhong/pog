import type { PlayerDocument, Profile } from "../domain/types";
import { newId } from "../map/editing";

export const activeProfile = (player: PlayerDocument): Profile =>
  player.profiles.find((p) => p.id === player.activeProfile) ??
  player.profiles[0];

/** Start a new, empty playthrough and switch to it. */
export function addProfile(player: PlayerDocument): PlayerDocument {
  const profile: Profile = {
    id: newId("profile"),
    name: "",
    goal: "",
    constraints: "",
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
