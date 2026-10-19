import type { Point } from "../domain/types";

/** A rectangle on screen, in pixels. */
export type Box = { left: number; top: number; right: number; bottom: number };

const segmentLengths = (line: Point[]) =>
  line.slice(1).map(([x, y], i) => Math.hypot(x - line[i][0], y - line[i][1]));

/** The point halfway along a line, by length. */
export function halfway(line: Point[]): Point {
  const lengths = segmentLengths(line);
  let left = lengths.reduce((sum, l) => sum + l, 0) / 2;
  for (const [i, l] of lengths.entries()) {
    if (left <= l && l > 0) {
      const [[ax, ay], [bx, by]] = [line[i], line[i + 1]];
      return [ax + ((bx - ax) * left) / l, ay + ((by - ay) * left) / l];
    }
    left -= l;
  }
  return line[0];
}

/** The part of segment a–b inside the box (Liang–Barsky), or null. */
function clip(a: Point, b: Point, box: Box): [Point, Point] | null {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  let [t0, t1] = [0, 1];
  const edges: [number, number][] = [
    [-dx, a[0] - box.left],
    [dx, box.right - a[0]],
    [-dy, a[1] - box.top],
    [dy, box.bottom - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  const at = (t: number): Point => [a[0] + dx * t, a[1] + dy * t];
  return [at(t0), at(t1)];
}

/**
 * Where to show a path's step number on screen. Halfway along the longest
 * stretch of the path inside `box` (`stretch`, to move the number along when
 * something covers it); when none of it is inside, on the edge of `box`
 * nearest the path's middle, so the number stays in view. Isolated portal
 * endpoints are single-point lines; prefer one that is on screen.
 */
export function placeStep(
  lines: Point[][],
  box: Box,
): { point: Point; pinned: boolean; stretch?: Point[] } {
  let best: Point[] | null = null;
  let bestLength = -1;
  for (const line of lines) {
    if (line.length === 1) {
      const [x, y] = line[0];
      if (
        bestLength < 0 &&
        x >= box.left &&
        x <= box.right &&
        y >= box.top &&
        y <= box.bottom
      )
        [best, bestLength] = [line, 0];
      continue;
    }
    // Clipped pieces form one visible stretch while each starts where the
    // last ended; a piece that leaves the box ends early, which breaks it.
    let run: Point[] = [];
    const finish = () => {
      const length = segmentLengths(run).reduce((sum, l) => sum + l, 0);
      if (run.length > 1 && length > bestLength)
        [best, bestLength] = [run, length];
      run = [];
    };
    for (let i = 1; i < line.length; i++) {
      const piece = clip(line[i - 1], line[i], box);
      if (!piece) {
        finish();
        continue;
      }
      const last = run[run.length - 1];
      if (!last || last[0] !== piece[0][0] || last[1] !== piece[0][1]) {
        finish();
        run.push(piece[0]);
      }
      run.push(piece[1]);
    }
    finish();
  }
  if (best) {
    const stretch: Point[] = best;
    return stretch.length > 1
      ? { point: halfway(stretch), pinned: false, stretch }
      : { point: halfway(stretch), pinned: false };
  }
  const longest = lines.reduce((a, b) =>
    segmentLengths(b).reduce((s, l) => s + l, 0) >
    segmentLengths(a).reduce((s, l) => s + l, 0)
      ? b
      : a,
  );
  const [x, y] = halfway(longest);
  return {
    point: [
      Math.min(Math.max(x, box.left), box.right),
      Math.min(Math.max(y, box.top), box.bottom),
    ],
    pinned: true,
  };
}

/** A rectangle by its centre and half its width and height. */
export type Area = { center: Point; half: Point };

const overlaps = (a: Area, b: Area, gap: number) =>
  Math.abs(a.center[0] - b.center[0]) < a.half[0] + b.half[0] + gap &&
  Math.abs(a.center[1] - b.center[1]) < a.half[1] + b.half[1] + gap;

/** The point `distance` along a line, clamped to its ends. */
function pointAlong(line: Point[], distance: number): Point {
  let left = Math.max(distance, 0);
  for (let i = 1; i < line.length; i++) {
    const [[ax, ay], [bx, by]] = [line[i - 1], line[i]];
    const l = Math.hypot(bx - ax, by - ay);
    if (left <= l && l > 0)
      return [ax + ((bx - ax) * left) / l, ay + ((by - ay) * left) / l];
    left -= l;
  }
  return line[line.length - 1];
}

/**
 * Move a step number (`half` its size, at `point`) off the pins and graces
 * covering it, keeping `gap` pixels between them, so both stay readable and
 * clickable. It slides along its own `stretch` of path to the nearest clear
 * spot; when the stretch has none, it goes just beside the icon covering it.
 */
export function clearOfPins(
  point: Point,
  half: Point,
  stretch: Point[] | undefined,
  pins: Area[],
  gap: number,
): Point {
  const covering = (at: Point) =>
    pins.find((pin) => overlaps({ center: at, half }, pin, gap));
  const first = covering(point);
  if (!first) return point;
  if (stretch) {
    const total = segmentLengths(stretch).reduce((sum, l) => sum + l, 0);
    for (let d = 2; d <= total / 2; d += 2)
      for (const at of [total / 2 - d, total / 2 + d]) {
        const candidate = pointAlong(stretch, at);
        if (!covering(candidate)) return candidate;
      }
  }
  // Beside the icon: below, above, right or left, whichever is nearest and clear.
  const [cx, cy] = first.center;
  const dx = first.half[0] + half[0] + gap;
  const dy = first.half[1] + half[1] + gap;
  const beside: Point[] = [
    [point[0], cy + dy],
    [point[0], cy - dy],
    [cx + dx, point[1]],
    [cx - dx, point[1]],
  ];
  const byDistance = (a: Point, b: Point) =>
    Math.hypot(a[0] - point[0], a[1] - point[1]) -
    Math.hypot(b[0] - point[0], b[1] - point[1]);
  return beside.sort(byDistance).find((at) => !covering(at)) ?? beside[0];
}

/**
 * Step numbers held on the same screen edge (`pinned` to `box`) spread out
 * along it, `gap` pixels apart, so each stays readable. Their order along
 * the edge is kept, and they stay inside the box when there's room.
 */
export function spreadAlongEdges(numbers: Area[], box: Box, gap: number) {
  const centers = numbers.map((n): Point => [...n.center]);
  const side = ([x, y]: Point) =>
    x <= box.left
      ? "left"
      : x >= box.right
        ? "right"
        : y <= box.top
          ? "top"
          : "bottom";
  for (const edge of ["left", "right", "top", "bottom"]) {
    // Along a left or right edge numbers move down it; along the others, across.
    const axis = edge === "left" || edge === "right" ? 1 : 0;
    const [start, end] = axis ? [box.top, box.bottom] : [box.left, box.right];
    const on = numbers
      .map((_, i) => i)
      .filter((i) => side(centers[i]) === edge)
      .sort((a, b) => centers[a][axis] - centers[b][axis]);
    for (let k = 1; k < on.length; k++) {
      const [a, b] = [on[k - 1], on[k]];
      const least =
        centers[a][axis] + numbers[a].half[axis] + numbers[b].half[axis] + gap;
      if (centers[b][axis] < least) centers[b][axis] = least;
    }
    // Pushed past the end: shift back, keeping them apart, as far as the start.
    for (let k = on.length - 1; k >= 0; k--) {
      const i = on[k];
      const limit =
        k === on.length - 1
          ? end
          : centers[on[k + 1]][axis] -
            numbers[on[k + 1]].half[axis] -
            numbers[i].half[axis] -
            gap;
      centers[i][axis] = Math.max(Math.min(centers[i][axis], limit), start);
    }
  }
  return centers;
}
