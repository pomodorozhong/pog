import type { PlayerDocument } from "../domain/types";
import type { Translate } from "../i18n/translation";
import {
  activeProfile,
  addProfile,
  removeProfile,
  updateProfile,
} from "./profiles";

export const profileName = (t: Translate, name: string) =>
  name || t("Untitled playthrough");

/** Switch between playthroughs from the header. */
export function ProfileSwitcher({
  t,
  player,
  setPlayer,
}: {
  t: Translate;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
}) {
  return (
    <select
      aria-label={t("Playthrough")}
      className="field max-w-48"
      value={player.activeProfile}
      onChange={(event) =>
        setPlayer({ ...player, activeProfile: event.target.value })
      }
    >
      {player.profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {profileName(t, p.name)}
        </option>
      ))}
    </select>
  );
}

/** Name, goal and constraints of the active playthrough. */
export function ProfilePanel({
  t,
  player,
  setPlayer,
}: {
  t: Translate;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
}) {
  const profile = activeProfile(player);
  const update = (changes: Parameters<typeof updateProfile>[2]) =>
    setPlayer(updateProfile(player, profile.id, changes));
  return (
    <section className="space-y-2" aria-label={t("Playthrough")}>
      <h3 className="label">{t("Playthrough")}</h3>
      <label className="block space-y-1">
        <span className="text-xs text-muted">{t("Name")}</span>
        <input
          className="field w-full"
          value={profile.name}
          placeholder={t("Untitled playthrough")}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">{t("Goal")}</span>
        <textarea
          className="field w-full"
          rows={2}
          value={profile.goal}
          placeholder={t("For example: a faith build that beats Malenia")}
          onChange={(e) => update({ goal: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">{t("Constraints")}</span>
        <textarea
          className="field w-full"
          rows={2}
          value={profile.constraints}
          placeholder={t("For example: no DLC, rune level 1, no Torrent")}
          onChange={(e) => update({ constraints: e.target.value })}
        />
      </label>
      <div className="flex gap-2">
        <button className="chip" onClick={() => setPlayer(addProfile(player))}>
          {t("New playthrough")}
        </button>
        {player.profiles.length > 1 && (
          <button
            className="chip chip--danger"
            onClick={() => {
              if (
                window.confirm(
                  t("Delete the playthrough “{name}”?", {
                    name: profileName(t, profile.name),
                  }),
                )
              )
                setPlayer(removeProfile(player, profile.id));
            }}
          >
            {t("Delete playthrough")}
          </button>
        )}
      </div>
    </section>
  );
}
