import type { MapDocument, PlayerDocument } from "../domain/types.ts";
import type { SaveStatus } from "../storage/usePersistentDocument.ts";

export const LIVE_SYNC_PATH = "/api/viewer";
/** Both documents at their largest, plus the screen state. */
export const MAX_SYNC_BYTES = 8 * 1024 * 1024 + 64 * 1024;

/** Where a scrolling panel is: through which entry, and how far through it. */
export type ScrollPosition = {
  /** Index of the top entry in view, or null for a panel without entries. */
  anchor: number | null;
  /** How far the panel's top is through that entry, from 0 to 1. */
  fraction: number;
  /** How far the panel is scrolled through all it can, from 0 to 1. */
  page: number;
};

/** What the operator's window shows, sent to viewers as it changes. */
export type LiveSnapshot = {
  player: PlayerDocument;
  /** The map of `mapProfile`, with edits not saved yet. */
  map: MapDocument;
  mapProfile: string;
  /** How saving the map and the player document is going. */
  saveStatus: SaveStatus[];
  /**
   * The rest of the screen, by key: shared UI state (`useSharedState`), the
   * map view while it moves, and scroll positions (`scroll:<panel>`).
   */
  ui: Record<string, unknown>;
};

export type ViewerMessage = {
  snapshot: LiveSnapshot | null;
  operatorConnected: boolean;
};

export type SyncStatus = "connecting" | "connected" | "disconnected";
