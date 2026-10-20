import { validDocument } from "../storage/schema.ts";
import type { LiveSnapshot, ViewerMessage } from "./types.ts";

const SAVE_STATUSES = [
  "loading",
  "saved",
  "saving",
  "failed",
  "conflict",
  "memory",
];

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

// The UI values are the operator's own screen state; the relay is local only,
// so they are checked for shape, not content.
export function validSnapshot(value: unknown): value is LiveSnapshot {
  return (
    record(value) &&
    validDocument("player", value.player) &&
    validDocument("map", value.map) &&
    typeof value.mapProfile === "string" &&
    value.player.profiles.some((p) => p.id === value.mapProfile) &&
    Array.isArray(value.saveStatus) &&
    value.saveStatus.every((s) => SAVE_STATUSES.includes(s)) &&
    record(value.ui)
  );
}

export function validViewerMessage(value: unknown): value is ViewerMessage {
  return (
    record(value) &&
    typeof value.operatorConnected === "boolean" &&
    (value.snapshot === null || validSnapshot(value.snapshot))
  );
}
