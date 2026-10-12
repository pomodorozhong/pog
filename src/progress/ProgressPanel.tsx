import type {
  Language,
  MapDocument,
  MapNode,
  PlayerDocument,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import { displayName, type GameData } from "../map/catalog";
import { NODE_KIND_NAMES } from "../map/labels";
import { activeProfile } from "../profiles/profiles";
import { discoveredCount, graceFlag, setFlag, setPosition } from "./progress";
import { SaveImport } from "./SaveImport";

type Props = {
  t: Translate;
  data: GameData;
  player: PlayerDocument;
  setPlayer(player: PlayerDocument): void;
};

/** Summary of the active playthrough's progress. */
export function ProgressPanel({
  t,
  language,
  data,
  player,
  setPlayer,
  doc,
  showNode,
}: Props & {
  language: Language;
  doc: MapDocument;
  showNode(id: string): void;
}) {
  const profile = activeProfile(player);
  const { position } = profile.progress;
  const here = position ? doc.nodes.find((n) => n.id === position) : undefined;
  return (
    <section className="space-y-2 text-sm" aria-label={t("Progress")}>
      <h3 className="label">{t("Progress")}</h3>
      <p className="text-muted">
        {t("{count} of {total} graces discovered", {
          count: discoveredCount(data, profile.progress),
          total: data.catalog.graces.length,
        })}
      </p>
      {here ? (
        <p className="flex flex-wrap items-center gap-x-3">
          <span>
            <span className="text-muted">{t("You are at")} </span>
            <button className="link" onClick={() => showNode(here.id)}>
              {displayName(data, here, language) ||
                t(NODE_KIND_NAMES[here.kind])}
            </button>
          </span>
          <button
            className="link ml-auto text-xs"
            onClick={() => setPlayer(setPosition(player, profile.id, null))}
          >
            {t("Clear")}
          </button>
        </p>
      ) : (
        <p className="text-xs text-muted">
          {t("Position not set: select a node and choose “I'm here”.")}
        </p>
      )}
      <SaveImport
        key={profile.id}
        t={t}
        language={language}
        data={data}
        player={player}
        setPlayer={setPlayer}
      />
    </section>
  );
}

/** Progress controls for a selected node: discovered, and "I'm here". */
export function NodeProgress({
  t,
  data,
  player,
  setPlayer,
  node,
}: Props & { node: MapNode }) {
  const profile = activeProfile(player);
  const flag = graceFlag(data, node);
  const here = profile.progress.position === node.id;
  return (
    <div className="space-y-2">
      {flag !== undefined && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.progress.flags.includes(flag)}
            onChange={(e) =>
              setPlayer(setFlag(player, profile.id, flag, e.target.checked))
            }
          />
          {t("Discovered in this playthrough")}
        </label>
      )}
      {here ? (
        <p className="text-sm text-muted">{t("You are here.")}</p>
      ) : (
        <button
          className="chip"
          onClick={() => setPlayer(setPosition(player, profile.id, node.id))}
        >
          {t("I'm here")}
        </button>
      )}
    </div>
  );
}
