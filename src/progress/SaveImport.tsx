import { useState } from "react";
import type { Language, PlayerDocument, SaveLink } from "../domain/types";
import type { Translate } from "../i18n/translation";
import type { GameData } from "../map/catalog";
import { activeProfile } from "../profiles/profiles";
import {
  applyImport,
  fetchSaves,
  fetchSlotFlags,
  planImport,
  type ImportPlan,
  type SaveSummary,
} from "./importSave";

type Step =
  | { kind: "idle"; message?: string; failed?: boolean }
  | { kind: "busy" }
  | { kind: "pick"; saves: SaveSummary[] }
  | { kind: "renamed"; link: SaveLink; found: string }
  | { kind: "review"; link: SaveLink; plan: ImportPlan };

/** "Import progress from save": read the linked character's flags, show what changes, apply. */
export function SaveImport({
  t,
  language,
  data,
  player,
  setPlayer,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
}) {
  const profile = activeProfile(player);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const known = data.catalog.graces.map((g) => g.flag);
  const graceName = new Map(
    data.catalog.graces.map((g) => [g.flag, g.name[language]]),
  );
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
  const read = (link: SaveLink, confirmed = false) =>
    attempt(async () => {
      const result = await fetchSlotFlags(link, known);
      if (!confirmed && result.name !== link.name)
        return { kind: "renamed", link, found: result.name };
      return {
        kind: "review",
        link: { ...link, name: result.name },
        plan: planImport(profile.progress, known, result.set),
      };
    });

  const pick = () =>
    attempt(async () => ({ kind: "pick", saves: await fetchSaves() }));

  return (
    <div className="space-y-2" aria-label={t("Import progress from save")}>
      {profile.save && (
        <p className="text-xs text-muted">
          {t("Linked to {character}", {
            character: slotName(profile.save),
          })}
        </p>
      )}
      {(step.kind === "idle" || step.kind === "busy") && (
        <div className="flex flex-wrap gap-2">
          <button
            className="chip"
            disabled={step.kind === "busy"}
            onClick={() =>
              profile.save ? void read(profile.save) : void pick()
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
          {step.saves.flatMap((save) =>
            save.slots.map((slot) => (
              <button
                key={`${save.steamId}/${slot.index}`}
                className="chip mr-2"
                title={t("Steam ID {id}", { id: save.steamId })}
                onClick={() =>
                  void read(
                    {
                      steamId: save.steamId,
                      slot: slot.index,
                      name: slot.name,
                    },
                    true,
                  )
                }
              >
                {slotName({ slot: slot.index, name: slot.name })}
              </button>
            )),
          )}
          {!step.saves.some((s) => s.slots.length) && (
            <p className="text-xs text-danger">{t("No characters found.")}</p>
          )}
          <button
            className="link text-xs"
            onClick={() => setStep({ kind: "idle" })}
          >
            {t("Cancel")}
          </button>
        </div>
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
            <button className="chip" onClick={() => void read(step.link, true)}>
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
          {step.plan.added.length + step.plan.removed.length === 0 ? (
            <p className="text-muted">{t("Nothing has changed.")}</p>
          ) : (
            <p className="text-muted">
              {t("+{added} graces discovered, −{removed} not discovered", {
                added: step.plan.added.length,
                removed: step.plan.removed.length,
              })}
            </p>
          )}
          {step.plan.added.length + step.plan.removed.length > 0 && (
            <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded border border-line p-2 text-xs">
              {step.plan.added.map((flag) => (
                <li key={`+${flag}`}>
                  +{" "}
                  {t("Discovered {grace}", {
                    grace: graceName.get(flag) ?? flag,
                  })}
                </li>
              ))}
              {step.plan.removed.map((flag) => (
                <li key={`-${flag}`} className="text-danger">
                  −{" "}
                  {t("Not discovered: {grace}", {
                    grace: graceName.get(flag) ?? flag,
                  })}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              className="chip"
              onClick={() => {
                setPlayer(
                  applyImport(player, profile.id, step.plan, step.link),
                );
                setStep({ kind: "idle", message: t("Progress imported.") });
              }}
            >
              {t("Apply")}
            </button>
            <button className="chip" onClick={() => setStep({ kind: "idle" })}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
