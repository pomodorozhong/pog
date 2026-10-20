import { useEffect, useRef } from "react";
import type { Language, MapDocument, PlayerDocument } from "../domain/types";
import type { Translate } from "../i18n/translation";
import type { GameData } from "../map/catalog";
import { activeProfile } from "../profiles/profiles";
import {
  applyImport,
  changesSomething,
  fetchSaveStamp,
  fetchSlotFlags,
  importFlags,
  lastGraceOnMap,
  planImport,
  SaveRequestError,
  summarizeChanges,
} from "./importSave";
import { useShared, useSharedState } from "../sync/shared";

/** How often the save's modification time is checked. */
export const AUTO_IMPORT_INTERVAL = 3000;
/** How long the note about an import stays. */
const NOTE_TIME = 6000;

/** A note, for the link it was about (`watching`). */
type Notice = { watching: string } & (
  { kind: "imported"; text: string } | { kind: "renamed"; found: string }
);

/**
 * Re-import progress whenever the game saves, while the app is open, the
 * setting is on and the active playthrough is linked to a character. Changes
 * apply without a review and a short note says what changed. A linked slot
 * that now holds another character pauses it and asks, as the manual import
 * does.
 */
export function AutoImport({
  t,
  language,
  data,
  player,
  setPlayer,
  doc,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
  /** The profile's map with its game graces, loaded. */
  doc: MapDocument;
}) {
  const [notice, setNotice] = useSharedState<Notice | null>(
    "auto-import.notice",
    null,
  );
  // The polling reads the latest of these without restarting.
  const latest = useRef({ t, language, data, player, setPlayer, doc });
  useEffect(() => {
    latest.current = { t, language, data, player, setPlayer, doc };
  });

  const profile = activeProfile(player);
  const link = profile.save;
  // Polling restarts, and imports at once, when any of these change.
  // A viewer shows the operator's imports; it never reads the save itself.
  const { viewer } = useShared();
  const watching =
    !viewer && player.autoImport && link
      ? JSON.stringify([
          profile.id,
          link.steamId,
          link.slot,
          link.name,
          player.saveLocation,
        ])
      : null;

  useEffect(() => {
    if (!watching) return;
    const about = watching;
    let stopped = false;
    let seen: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      const { t, language, data, doc, player } = latest.current;
      const location = player.saveLocation;
      const profile = activeProfile(player);
      const link = profile.save;
      let stamp: string | null = null;
      try {
        stamp = await fetchSaveStamp(location);
        if (link && stamp && stamp !== seen) {
          const { known, isBoss } = importFlags(data, doc, language);
          const result = await fetchSlotFlags(location, link, known);
          if (stopped) return;
          seen = stamp;
          if (result.name !== link.name) {
            setNotice({ watching: about, kind: "renamed", found: result.name });
            return; // Paused until the player answers.
          }
          const now = latest.current.player;
          // The save decides every grace and boss, as the manual import does.
          const plan = planImport(
            activeProfile(now).progress,
            known,
            result.set,
            lastGraceOnMap(data, doc, result.lastGrace),
          );
          if (changesSomething(plan)) {
            latest.current.setPlayer(
              applyImport(now, profile.id, plan, link, location),
            );
            const changes = [
              summarizeChanges(t, plan, isBoss),
              plan.moveTo &&
                t("You're at {grace}", {
                  grace: data.byId.get(plan.moveTo)?.name[language] ?? "",
                }),
            ]
              .filter(Boolean)
              .join(" · ");
            // Only the last grace's record changed: nothing to say.
            if (changes)
              setNotice({
                watching: about,
                kind: "imported",
                text: t("Imported from the save: {changes}", { changes }),
              });
          }
        }
      } catch (error) {
        // A checksum mismatch means the game was writing: read again at the
        // next check. Anything else waits until the save changes, so a save
        // that can't be read isn't read every few seconds. The manual import
        // says why.
        if (!(error instanceof SaveRequestError && error.status === 409))
          seen = stamp;
      }
      if (!stopped) timer = setTimeout(check, AUTO_IMPORT_INTERVAL);
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [watching, setNotice]);

  useEffect(() => {
    if (notice?.kind !== "imported") return;
    const timer = setTimeout(() => setNotice(null), NOTE_TIME);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  // A note about another playthrough, or an earlier link, is gone.
  if (!notice || !link || notice.watching !== watching) return null;
  return (
    <div
      role="status"
      className="popover fixed bottom-4 left-1/2 z-[1200] flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-2 p-3 text-sm"
    >
      {notice.kind === "imported" ? (
        <p>{notice.text}</p>
      ) : (
        <>
          <p>
            {t(
              "Automatic import paused: slot {slot} now holds “{found}”, not “{name}”. Is it still this playthrough?",
              { slot: link.slot + 1, found: notice.found, name: link.name },
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="chip"
              onClick={() =>
                // Linking the new name restarts the import, which applies at once.
                setPlayer({
                  ...player,
                  profiles: player.profiles.map((p) =>
                    p.id === profile.id
                      ? { ...p, save: { ...link, name: notice.found } }
                      : p,
                  ),
                })
              }
            >
              {t("Import from “{name}”", { name: notice.found })}
            </button>
            <button className="chip" onClick={() => setNotice(null)}>
              {t("Not now")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The automatic import's switch, with what it does and what it's doing now.
 * Shown with the save import and in the ☰ menu.
 */
export function AutoImportSwitch({
  t,
  player,
  setPlayer,
}: {
  t: Translate;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
}) {
  const link = activeProfile(player).save;
  const status = !player.autoImport
    ? t(
        "Off: progress changes only when you choose “Import progress from save”.",
      )
    : link
      ? t("On: watching {character}.", {
          character: t("{name} (slot {slot})", {
            name: link.name,
            slot: link.slot + 1,
          }),
        })
      : t(
          "On: starts once this playthrough is linked to a character by “Import progress from save”.",
        );
  return (
    <section
      aria-label={t("Import automatically")}
      className="space-y-1.5 rounded-lg border border-line bg-ink/60 p-2.5"
    >
      <label className="flex items-center justify-between gap-2">
        <span className="font-medium">{t("Import automatically")}</span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={player.autoImport}
          onChange={(event) =>
            setPlayer({ ...player, autoImport: event.target.checked })
          }
        />
      </label>
      <p
        className={`text-xs ${player.autoImport && link ? "text-gold" : "text-muted"}`}
      >
        {status}
      </p>
      <p className="text-xs text-muted">
        {t(
          "Each time the game saves, graces discovered and bosses beaten on this map are read from the linked character and applied at once, with a short note of what changed. The save decides every grace and boss on this map: one you marked by hand is cleared if the save doesn't have it. When the character rests at a new grace, “I'm here” moves there. Items aren't read. Applies to every playthrough.",
        )}
      </p>
    </section>
  );
}
