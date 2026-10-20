import type { MapNode, Point, WishlistStatus } from "../domain/types";
import type { Box } from "./stepPlacement";

/** One direction arrow: where it sits on screen, and its angle in degrees. */
export type Arrow = { point: Point; angle: number };

/**
 * Arrows along a line drawn on screen, pointing the way it goes: one every
 * `spacing` pixels, the first half a spacing in, so each stretch between two
 * pins gets one when it's long enough. Arrows outside `box` are left out, so
 * a long path zoomed in only gets the ones on screen.
 */
export function arrowsAlong(line: Point[], spacing: number, box: Box): Arrow[] {
  const arrows: Arrow[] = [];
  let next = spacing / 2;
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [[ax, ay], [bx, by]] = [line[i - 1], line[i]];
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) continue;
    const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    while (next <= walked + length) {
      const t = (next - walked) / length;
      const point: Point = [ax + (bx - ax) * t, ay + (by - ay) * t];
      if (
        point[0] >= box.left &&
        point[0] <= box.right &&
        point[1] >= box.top &&
        point[1] <= box.bottom
      )
        arrows.push({ point, angle });
      next += spacing;
    }
    walked += length;
  }
  return arrows;
}

/**
 * The path the player is on, among the walked paths through where they are,
 * the lowest step first: the first with something left to do on it
 * (`unfinished` pins), so at a pin one path ends and the next starts, the
 * one ending stays current until it's done. With nothing left on any, the
 * first they're partway along or starting.
 */
export function currentPath<
  E extends { id: string; nodes: string[]; step: number | null },
>(edges: E[], position: string | null, unfinished: Set<string>): E | undefined {
  if (!position) return undefined;
  const through = edges
    .filter((e) => e.step !== null && e.nodes.length > 1)
    .filter((e) => e.nodes.includes(position))
    .sort((a, b) => a.step! - b.step!);
  return (
    through.find((e) => e.nodes.some((id) => unfinished.has(id))) ??
    through.find((e) => e.nodes.slice(0, -1).includes(position))
  );
}

/**
 * Pins with something left to do: a grace not yet discovered, a boss not
 * beaten, or a wishlist entry still needed.
 */
export function unfinishedPins(
  nodes: MapNode[],
  undiscovered: Set<string>,
  beaten: Set<string>,
  wishlist: { pin: string; status: WishlistStatus }[],
): Set<string> {
  return new Set([
    ...undiscovered,
    ...nodes
      .filter((n) => (n.bosses ?? []).some((id) => !beaten.has(id)))
      .map((n) => n.id),
    ...wishlist.filter((w) => w.status === "needed").map((w) => w.pin),
  ]);
}

/**
 * The parts of a line inside `box`, each a line of its own: a line leaving
 * the box and coming back gives two.
 */
export function clipToBox(line: Point[], box: Box): Point[][] {
  const parts: Point[][] = [];
  let current: Point[] | null = null;
  for (let i = 1; i < line.length; i++) {
    const [[ax, ay], [bx, by]] = [line[i - 1], line[i]];
    const [dx, dy] = [bx - ax, by - ay];
    // Liang–Barsky: narrow [t0, t1] to where the segment is inside the box.
    let [t0, t1] = [0, 1];
    for (const [p, q] of [
      [-dx, ax - box.left],
      [dx, box.right - ax],
      [-dy, ay - box.top],
      [dy, box.bottom - ay],
    ]) {
      if (p === 0) {
        if (q < 0) t0 = Infinity;
      } else if (p < 0) t0 = Math.max(t0, q / p);
      else t1 = Math.min(t1, q / p);
    }
    if (t0 > t1) {
      current = null;
      continue;
    }
    const start: Point = [ax + dx * t0, ay + dy * t0];
    const end: Point = [ax + dx * t1, ay + dy * t1];
    if (!current || t0 > 0) {
      current = [start];
      parts.push(current);
    }
    current.push(end);
    if (t1 < 1) current = null;
  }
  return parts.filter((part) => lineLength(part) > 0);
}

/** How long a line is, in its own units. */
export const lineLength = (line: Point[]) =>
  line.reduce(
    (sum, [x, y], i) =>
      i ? sum + Math.hypot(x - line[i - 1][0], y - line[i - 1][1]) : 0,
    0,
  );
