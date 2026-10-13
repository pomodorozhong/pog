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
 * stretch of the path inside `box`; when none of it is inside, on the edge
 * of `box` nearest the path's middle, so the number stays in view.
 */
export function placeStep(
  lines: Point[][],
  box: Box,
): { point: Point; pinned: boolean } {
  let best: Point[] | null = null;
  let bestLength = -1;
  for (const line of lines) {
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
  if (best) return { point: halfway(best), pinned: false };
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
