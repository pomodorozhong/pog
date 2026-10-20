import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MapDocument, PlayerDocument } from "../domain/types";
import type { GameData } from "../map/catalog";
import type { MapAction } from "../map/editing";
import { useShared, useSharedState } from "../sync/shared";
import { createAgentConnection } from "./connection";
import {
  AgentError,
  applyProposal,
  runTool,
  type Proposal,
  type ProposalOutcome,
  type ProposalProblem,
} from "./run";

type Options = {
  data: GameData | null;
  player: PlayerDocument | null;
  /** The active profile's map with the game graces, or null while it loads. */
  map: MapDocument | null;
  setPlayer(player: PlayerDocument): void;
  edit(action: MapAction): void;
};

/**
 * Agents' tool calls, run on what the app's window shows. Changes they ask
 * for wait as proposals until the player applies or dismisses them. The
 * queue lives in this window only, so a reload drops it; a mirror shows it.
 */
export function useAgent({ data, player, map, setPlayer, edit }: Options) {
  const shared = useShared();
  const [proposals, setProposals] = useSharedState<Proposal[]>(
    "agent.proposals",
    [],
  );
  const outcomes = useRef(new Map<string, ProposalOutcome>());
  const latest = useRef({ data, player, map, proposals });
  useEffect(() => {
    latest.current = { data, player, map, proposals };
  });

  useEffect(() => {
    if (shared.mirror || !shared.connected) return;
    const connection = createAgentConnection({
      onCall(call) {
        const { data, player, map, proposals } = latest.current;
        if (!data || !player || !map)
          return { error: "Path of Grace is still loading. Try again." };
        try {
          const { result, proposal } = runTool(call.tool, call.args, {
            data,
            player,
            map,
            proposals,
            outcomes: outcomes.current,
          });
          if (proposal) {
            // A second call can come before the next render.
            latest.current.proposals = [...proposals, proposal];
            setProposals(latest.current.proposals);
          }
          return { result };
        } catch (error) {
          if (error instanceof AgentError) return { error: error.message };
          throw error;
        }
      },
    });
    return () => connection.dispose();
  }, [shared, setProposals]);

  const problems = useMemo(() => {
    const result = new Map<string, ProposalProblem>();
    if (!player || !map) return result;
    for (const p of proposals) {
      const applied = applyProposal(p, player, map);
      if ("problem" in applied) result.set(p.id, applied.problem);
    }
    return result;
  }, [proposals, player, map]);

  const settle = useCallback(
    (ids: Set<string>, outcome: ProposalOutcome) => {
      for (const id of ids) outcomes.current.set(id, outcome);
      latest.current.proposals = latest.current.proposals.filter(
        (p) => !ids.has(p.id),
      );
      setProposals(latest.current.proposals);
    },
    [setProposals],
  );

  /** Apply these proposals in order. Ones that went out of date stay. */
  const apply = useCallback(
    (ids: string[]) => {
      if (!player || !map) return;
      let next = player;
      const done = new Set<string>();
      for (const p of proposals) {
        if (!ids.includes(p.id)) continue;
        const applied = applyProposal(p, next, map);
        if ("problem" in applied) continue;
        next = applied.player;
        // Each new pin is its own undo step.
        if (applied.action) edit(applied.action);
        done.add(p.id);
      }
      if (next !== player) setPlayer(next);
      settle(done, "applied");
    },
    [player, map, proposals, edit, setPlayer, settle],
  );

  const dismiss = useCallback(
    (id: string) => settle(new Set([id]), "dismissed"),
    [settle],
  );

  return { proposals, problems, apply, dismiss };
}
