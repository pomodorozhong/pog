import { useCallback, useRef } from "react";
import type { Language, MapDocument } from "../domain/types";
import type { Translate } from "../i18n/translation";
import type { GameData } from "../map/catalog";
import { isGameGrace } from "../map/graces";
import { useDismiss } from "../layout/useDismiss";
import { useSharedState } from "../sync/shared";
import { nearestGrace, type Proposal, type ProposalProblem } from "./run";

const PROBLEMS: Record<ProposalProblem, string> = {
  "other-playthrough": "Proposed for another playthrough",
  "already-listed": "Already on the wishlist",
  "grace-gone": "That grace isn't on the map any more",
  "entry-gone": "That entry isn't on the wishlist any more",
};

/**
 * Changes agents proposed, for the player to apply or dismiss. The header
 * button shows only while some are waiting.
 */
export function AgentChanges({
  t,
  language,
  data,
  map,
  proposals,
  problems,
  apply,
  dismiss,
}: {
  t: Translate;
  language: Language;
  data: GameData;
  map: MapDocument;
  proposals: Proposal[];
  problems: ReadonlyMap<string, ProposalProblem>;
  apply(ids: string[]): void;
  dismiss(id: string): void;
}) {
  const [open, setOpen] = useSharedState("agent.open", false);
  const container = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(container, open && proposals.length > 0, close);
  if (!proposals.length) return null;

  const name = (id: string) => data.byId.get(id)?.name[language] ?? id;
  /** Where an entry's pin is, in words. */
  const place = (pin: string | null) => {
    const node = pin === null ? undefined : map.nodes.find((n) => n.id === pin);
    if (!node) return t("not attached to a pin");
    if (isGameGrace(node.id)) return name(node.id);
    if (node.label) return node.label;
    const grace = nearestGrace(map, node);
    return grace
      ? t("a pin near {grace}", { grace: name(grace.id) })
      : t("a pin");
  };
  const describe = (p: Proposal) =>
    p.kind === "note"
      ? t("Note on {item} ({place})", {
          item: name(p.item),
          place: place(p.pin),
        })
      : p.grace
        ? t("Add {item} on a new pin near {grace}", {
            item: name(p.item),
            grace: name(p.grace),
          })
        : t("Add {item}, not attached to a pin", { item: name(p.item) });
  const ready = proposals.filter((p) => !problems.has(p.id));

  return (
    <div ref={container} className="relative">
      <button
        className="chip text-xs"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t("Agent changes")}{" "}
        <span className="rounded-full bg-gold px-1.5 font-bold text-ink">
          {proposals.length}
        </span>
      </button>
      {open && (
        <section
          aria-label={t("Agent changes")}
          className="popover absolute top-full right-0 mt-1 flex max-h-[70vh] w-[min(20rem,calc(100vw-5rem))] flex-col gap-2 p-3.5 text-sm"
        >
          <p className="text-xs text-muted">
            {t(
              "An agent proposed these changes. Nothing changes until you apply them.",
            )}
          </p>
          <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {proposals.map((p) => {
              const problem = problems.get(p.id);
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-line p-2"
                >
                  <p>{describe(p)}</p>
                  {p.note !== undefined && (
                    <p className="text-xs whitespace-pre-wrap text-muted">
                      {p.note
                        ? t("Note: {note}", { note: p.note })
                        : t("Clears the note")}
                    </p>
                  )}
                  {problem && (
                    <p className="text-xs text-danger">
                      {t(PROBLEMS[problem])}
                    </p>
                  )}
                  <div className="flex gap-1.5">
                    {!problem && (
                      <button
                        className="chip"
                        aria-pressed="true"
                        onClick={() => apply([p.id])}
                      >
                        {t("Apply")}
                      </button>
                    )}
                    <button className="chip" onClick={() => dismiss(p.id)}>
                      {t("Dismiss")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {ready.length > 1 && (
            <button
              className="chip self-start"
              onClick={() => apply(ready.map((p) => p.id))}
            >
              {t("Apply all ({count})", { count: ready.length })}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
