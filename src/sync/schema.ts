import { validDocument } from "../storage/schema.ts";
import type { LiveSnapshot, MirrorMessage } from "./types.ts";

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

// The UI values are the app's own screen state; the relay is local only,
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

export function validMirrorMessage(value: unknown): value is MirrorMessage {
  return (
    record(value) &&
    typeof value.appConnected === "boolean" &&
    (value.snapshot === null || validSnapshot(value.snapshot))
  );
}
