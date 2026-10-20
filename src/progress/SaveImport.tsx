import type {
  Language,
  MapDocument,
  PlayerDocument,
  SaveLink,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import type { GameData } from "../map/catalog";
import { activeProfile } from "../profiles/profiles";
import {
  applyImport,
  changesSomething,
  fetchSaves,
  fetchSlotFlags,
  importFlags,
  lastGraceOnMap,
  planImport,
  summarizeChanges,
  type ImportPlan,
  type SaveSearch,
} from "./importSave";
import { useSharedState } from "../sync/shared";

/** Each step that reads a save keeps where it is: a path, or null to look everywhere. */
type Step =
  | { kind: "idle"; message?: string; failed?: boolean }
  | { kind: "busy" }
  | ({ kind: "pick" } & SaveSearch)
  | { kind: "choose"; path: string }
  | { kind: "renamed"; link: SaveLink; found: string; location: string | null }
  | {
      kind: "review";
      link: SaveLink;
      plan: ImportPlan;
      location: string | null;
    };

/**
 * "Import progress from save": read the linked character's flags, show what
 * changes, apply. It asks about every grace, about the bosses at the map's
 * pins and graces, and about the pickups of the wishlist entries the game
 * data tracks; other flags stay as they are.
 */
export function SaveImport({
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
  /** The profile's map with its game graces. */
  doc: MapDocument;
}) {
  const profile = activeProfile(player);
  const [step, setStep] = useSharedState<Step>("save-import.step", {
    kind: "idle",
  });
  const { known, isBoss, isItem, bossName, graceName, itemName, tracked } =
    importFlags(data, doc, language, profile.wishlist);
  const slotName = (link: { slot: number; name: string }) =>
    t("{name} (slot {slot})", { name: link.name, slot: link.slot + 1 });

  async function attempt(run: () => Promise<Step>) {
    setStep({ kind: "busy" });
    try {
      setStep(await run());
    } catch (error) {
      setStep({
        kind: "idle",
        message: (error as Error).message,
        failed: true,
      });
    }
  }

  /** Read a slot; a linked slot now holding another character asks first. */
  const read = (link: SaveLink, location: string | null, confirmed = false) =>
    attempt(async () => {
      const result = await fetchSlotFlags(location, link, known);
      if (!confirmed && result.name !== link.name)
        return { kind: "renamed", link, found: result.name, location };
      return {
        kind: "review",
        link: { ...link, name: result.name },
        plan: planImport(
          profile.progress,
          known,
          result.set,
          lastGraceOnMap(data, doc, result.lastGrace),
          tracked,
        ),
        location,
      };
    });

  /** List the characters at a location, or wherever the game keeps saves. */
  const pick = (location: string | null = null) =>
    attempt(async () => ({ kind: "pick", ...(await fetchSaves(location)) }));

  return (
    <div className="space-y-2" aria-label={t("Import progress from save")}>
      {profile.save && (
        <p className="text-xs text-muted">
          {t("Linked to {character}", {
            character: slotName(profile.save),
          })}
        </p>
      )}
      {player.saveLocation && (
        <p
          className="truncate text-xs text-muted [direction:rtl]"
          title={player.saveLocation}
        >
          {/* The end of the path names the save; the start is cut instead. */}
          <bdi>{player.saveLocation}</bdi>
        </p>
      )}
      {(step.kind === "idle" || step.kind === "busy") && (
        <div className="flex flex-wrap gap-2">
          <button
            className="chip"
            disabled={step.kind === "busy"}
            onClick={() =>
              profile.save
                ? void read(profile.save, player.saveLocation)
                : void pick()
            }
          >
            {step.kind === "busy"
              ? t("Reading the save…")
              : t("Import progress from save")}
          </button>
          {profile.save && step.kind === "idle" && (
            <button className="link text-xs" onClick={() => void pick()}>
              {t("Change character")}
            </button>
          )}
        </div>
      )}
      {step.kind === "idle" && step.message && (
        <p
          role="status"
          className={`text-xs ${step.failed ? "text-danger" : "text-muted"}`}
        >
          {step.message}
        </p>
      )}

      {step.kind === "pick" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            {t("Which character is this playthrough?")}
          </p>
          {step.saves.map((save) => (
            <div key={save.file} className="space-y-1">
              {/* Saves in two places can share a Steam ID; the path tells them apart. */}
              <p
                className="truncate text-xs text-muted [direction:rtl]"
                title={save.file}
              >
                <bdi>{save.file}</bdi>
              </p>
              <div className="flex flex-wrap gap-2">
                {save.slots.map((slot) => (
                  <button
                    key={slot.index}
                    className="chip"
                    title={t("Steam ID {id}", { id: save.steamId })}
                    onClick={() =>
                      void read(
                        {
                          steamId: save.steamId,
                          slot: slot.index,
                          name: slot.name,
                        },
                        save.file,
                        true,
                      )
                    }
                  >
                    {slotName({ slot: slot.index, name: slot.name })}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!step.saves.some((s) => s.slots.length) && (
            <div className="space-y-1 text-xs">
              <p className="text-danger">
                {t(
                  step.saves.length
                    ? "No characters found."
                    : "No Elden Ring saves found. Looked in:",
                )}
              </p>
              {!step.saves.length && (
                <ul className="space-y-0.5 text-muted">
                  {step.searched.map((place) => (
                    <li key={place} className="break-all">
                      {place}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="link text-xs"
              onClick={() =>
                setStep({ kind: "choose", path: player.saveLocation ?? "" })
              }
            >
              {t("Choose another location")}
            </button>
            <button
              className="link text-xs"
              onClick={() => setStep({ kind: "idle" })}
            >
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}

      {step.kind === "choose" && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void pick(step.path.trim());
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t("Save folder or ER0000.sl2 file (full path)")}
            <input
              className="field w-full"
              value={step.path}
              placeholder="/Users/…/AppData/Roaming/EldenRing"
              autoFocus
              onChange={(e) =>
                setStep({ kind: "choose", path: e.target.value })
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="chip"
              type="submit"
              disabled={!step.path.trim().startsWith("/")}
            >
              {t("Look here")}
            </button>
            <button className="chip" type="button" onClick={() => void pick()}>
              {t("Look everywhere")}
            </button>
            <button
              className="link text-xs"
              type="button"
              onClick={() => setStep({ kind: "idle" })}
            >
              {t("Cancel")}
            </button>
          </div>
        </form>
      )}

      {step.kind === "renamed" && (
        <div className="space-y-2 text-sm">
          <p>
            {t(
              "Slot {slot} now holds “{found}”, not “{name}”. Is it still this playthrough?",
              {
                slot: step.link.slot + 1,
                found: step.found,
                name: step.link.name,
              },
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="chip"
              onClick={() => void read(step.link, step.location, true)}
            >
              {t("Import from “{name}”", { name: step.found })}
            </button>
            <button className="chip" onClick={() => void pick()}>
              {t("Pick another character")}
            </button>
          </div>
        </div>
      )}

      {step.kind === "review" && (
        <div className="space-y-2 text-sm">
          <p>{t("From {character}:", { character: slotName(step.link) })}</p>
          {step.plan.added.length +
            step.plan.removed.length +
            step.plan.acquired.length >
          0 ? (
            <p className="text-muted">
              {summarizeChanges(t, step.plan, isBoss, isItem)}
            </p>
          ) : (
            !step.plan.moveTo && (
              <p className="text-muted">{t("Nothing has changed.")}</p>
            )
          )}
          {step.plan.moveTo && (
            <p>
              {t("Last rested at {grace}: “I'm here” moves there.", {
                grace: data.byId.get(step.plan.moveTo)?.name[language] ?? "",
              })}
            </p>
          )}
          {step.plan.added.length + step.plan.removed.length > 0 && (
            <ul
              data-scroll-sync="save-slots"
              className="max-h-48 space-y-0.5 overflow-y-auto rounded border border-line p-2 text-xs"
            >
              {step.plan.added.map((flag) => (
                <li key={`+${flag}`}>
                  +{" "}
                  {isBoss(flag)
                    ? t("Beaten {boss}", { boss: bossName.get(flag) ?? flag })
                    : isItem(flag)
                      ? t("Picked up {item}", {
                          item: itemName.get(flag) ?? flag,
                        })
                      : t("Discovered {grace}", {
                          grace: graceName.get(flag) ?? flag,
                        })}
                </li>
              ))}
              {step.plan.removed.map((flag) => (
                <li key={`-${flag}`} className="text-danger">
                  −{" "}
                  {isBoss(flag)
                    ? t("Not beaten: {boss}", {
                        boss: bossName.get(flag) ?? flag,
                      })
                    : isItem(flag)
                      ? t("Not picked up: {item}", {
                          item: itemName.get(flag) ?? flag,
                        })
                      : t("Not discovered: {grace}", {
                          grace: graceName.get(flag) ?? flag,
                        })}
                </li>
              ))}
            </ul>
          )}
          {showsChanges(step.plan) ? (
            <div className="flex gap-2">
              <button
                className="chip"
                onClick={() => {
                  setPlayer(
                    applyImport(
                      player,
                      profile.id,
                      step.plan,
                      step.link,
                      step.location,
                    ),
                  );
                  setStep({ kind: "idle", message: t("Progress imported.") });
                }}
              >
                {t("Apply")}
              </button>
              <button
                className="chip"
                onClick={() => setStep({ kind: "idle" })}
              >
                {t("Cancel")}
              </button>
            </div>
          ) : (
            <button
              className="chip"
              onClick={() => {
                // Nothing to review, but the link to this character and the
                // last grace rested at are still kept, as Apply would.
                setPlayer(
                  applyImport(
                    player,
                    profile.id,
                    step.plan,
                    step.link,
                    step.location,
                  ),
                );
                setStep({ kind: "idle" });
              }}
            >
              {t("Close")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Whether the plan changes anything the review shows: everything but the
 * record of the last grace rested at, when "I'm here" is already there.
 */
const showsChanges = (plan: ImportPlan) =>
  changesSomething({ ...plan, lastGrace: null }) || plan.moveTo !== null;
