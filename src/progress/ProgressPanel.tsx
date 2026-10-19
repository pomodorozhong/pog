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
  const count = discoveredCount(data, profile.progress);
  const total = data.catalog.graces.length;
  return (
    <section className="card space-y-3 text-sm" aria-label={t("Progress")}>
      <div>
        <h3 className="label">{t("Graces discovered")}</h3>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="font-serif text-3xl leading-none">{count}</span>
          <span className="text-muted">
            {t("of {total}", { total: String(total) })}
          </span>
        </p>
      </div>
      <div aria-hidden="true" className="h-1.5 rounded-full bg-ink">
        <div
          className="h-1.5 rounded-full bg-gold"
          style={{ width: `${total ? (count / total) * 100 : 0}%` }}
        />
      </div>
      <SaveImport
        key={profile.id}
        t={t}
        language={language}
        data={data}
        player={player}
        setPlayer={setPlayer}
        doc={doc}
      />
      <div className="flex items-center gap-2.5 border-t border-[#22352e] pt-2.5">
        {here ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">
                {t("You are at")}
              </span>
              <button
                className="link block truncate text-left"
                onClick={() => showNode(here.id)}
              >
                {displayName(data, here, language) ||
                  t(NODE_KIND_NAMES[here.kind])}
              </button>
            </span>
            <button
              className="link text-xs"
              onClick={() => setPlayer(setPosition(player, profile.id, null))}
            >
              {t("Clear")}
            </button>
          </>
        ) : (
          <p className="text-xs text-muted">
            {t("Position not set: select a node and choose “I'm here”.")}
          </p>
        )}
      </div>
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
    <>
      {flag !== undefined && (
        <button
          className="chip"
          aria-pressed={profile.progress.flags.includes(flag)}
          onClick={() =>
            setPlayer(
              setFlag(
                player,
                profile.id,
                flag,
                !profile.progress.flags.includes(flag),
              ),
            )
          }
        >
          {t("Discovered")}
        </button>
      )}
      {here ? (
        <span className="px-1 text-sm text-muted">{t("You are here.")}</span>
      ) : (
        <button
          className="chip"
          onClick={() => setPlayer(setPosition(player, profile.id, node.id))}
        >
          {t("I'm here")}
        </button>
      )}
    </>
  );
}
