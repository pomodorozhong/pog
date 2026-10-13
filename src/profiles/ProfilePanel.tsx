import { useState } from "react";
import {
  EDGE_TYPES,
  LAYERS,
  type LayerId,
  type MapDocument,
  type PlayerDocument,
} from "../domain/types";
import type { Translate } from "../i18n/translation";
import type { MapAction } from "../map/editing";
import { EDGE_NAMES, LAYER_NAMES } from "../map/labels";
import { importMap } from "./importMap";
import {
  activeProfile,
  addProfile,
  removeProfile,
  TEMPLATES,
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={profile.rules.dlc}
          onChange={(e) =>
            update({ rules: { ...profile.rules, dlc: e.target.checked } })
          }
        />
        {t("Includes Shadow of the Erdtree")}
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs text-muted">
          {t("Paths the route avoids")}
        </legend>
        <div className="flex flex-wrap gap-1">
          {EDGE_TYPES.map((type) => {
            const avoided = profile.rules.avoid.includes(type);
            return (
              <button
                key={type}
                className="chip text-xs"
                aria-pressed={avoided}
                onClick={() =>
                  update({
                    rules: {
                      ...profile.rules,
                      avoid: avoided
                        ? profile.rules.avoid.filter((a) => a !== type)
                        : [...profile.rules.avoid, type],
                    },
                  })
                }
              >
                {t(EDGE_NAMES[type])}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button className="chip" onClick={() => setPlayer(addProfile(player))}>
          {t("New playthrough")}
        </button>
        {TEMPLATES.map((template) => (
          <button
            key={template.name}
            className="chip"
            title={t("Starts with its wishlist of {count} items", {
              count: template.wishlist.length,
            })}
            onClick={() => setPlayer(addProfile(player, template))}
          >
            {t("New “{name}” playthrough", { name: template.name })}
          </button>
        ))}
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

/** Copy another playthrough's map annotations into the active one. */
export function ImportFromProfile({
  t,
  player,
  doc,
  readMap,
  edit,
}: {
  t: Translate;
  player: PlayerDocument;
  doc: MapDocument;
  /** The saved map of a profile, or null when it can't be read. */
  readMap(profile: string): Promise<MapDocument | null>;
  edit(action: MapAction): void;
}) {
  const others = player.profiles.filter((p) => p.id !== player.activeProfile);
  const [source, setSource] = useState("");
  const [layer, setLayer] = useState<LayerId | "">("");
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!others.length) return null;
  const from = others.some((p) => p.id === source) ? source : others[0].id;

  async function run() {
    setBusy(true);
    const map = await readMap(from);
    setBusy(false);
    if (!map) return setResult(t("That playthrough's map cannot be read."));
    const copied = importMap(doc, map, layer || undefined);
    if (copied.nodes || copied.edges) edit(copied.action);
    setResult(
      t("Copied {nodes} nodes and {paths} paths.", {
        nodes: String(copied.nodes),
        paths: String(copied.edges),
      }),
    );
  }

  return (
    <section
      className="space-y-2"
      aria-label={t("Import from another playthrough")}
    >
      <h3 className="label">{t("Import from another playthrough")}</h3>
      <p className="text-xs text-muted">
        {t(
          "Copies its nodes and paths onto this map. Nodes already here are kept.",
        )}
      </p>
      <div className="flex gap-2">
        <select
          aria-label={t("Playthrough to import from")}
          className="field min-w-0 flex-1"
          value={from}
          onChange={(e) => setSource(e.target.value)}
        >
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {profileName(t, p.name)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("Map layer")}
          className="field min-w-0 flex-1"
          value={layer}
          onChange={(e) => setLayer(e.target.value as LayerId | "")}
        >
          <option value="">{t("All layers")}</option>
          {LAYERS.map((id) => (
            <option key={id} value={id}>
              {t(LAYER_NAMES[id])}
            </option>
          ))}
        </select>
      </div>
      <button className="chip" disabled={busy} onClick={() => void run()}>
        {t("Import")}
      </button>
      {result && (
        <p role="status" className="text-xs text-muted">
          {result}
        </p>
      )}
    </section>
  );
}
