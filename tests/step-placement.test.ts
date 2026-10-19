import { describe, expect, it } from "vitest";
import {
  clearOfPins,
  halfway,
  placeStep,
  spreadAlongEdges,
} from "../src/map/stepPlacement";

const box = { left: 0, top: 0, right: 100, bottom: 100 };

describe("step number placement", () => {
  it("goes halfway along a path that is on screen", () => {
    expect(
      placeStep(
        [
          [
            [10, 50],
            [90, 50],
          ],
        ],
        box,
      ),
    ).toEqual({
      point: [50, 50],
      pinned: false,
      stretch: [
        [10, 50],
        [90, 50],
      ],
    });
  });

  it("stays on the part of the path that is on screen", () => {
    // From x = 50 out to x = 450: only 50..100 is visible.
    expect(
      placeStep(
        [
          [
            [50, 20],
            [450, 20],
          ],
        ],
        box,
      ),
    ).toMatchObject({ point: [75, 20], pinned: false });
  });

  it("takes the longest visible stretch of a path that leaves and comes back", () => {
    const { point } = placeStep(
      [
        [
          [90, 10],
          [200, 10], // leaves at x = 100: 10 px visible
          [200, 80],
          [20, 80], // comes back at x = 100: 80 px visible
        ],
      ],
      box,
    );
    expect(point).toEqual([60, 80]);
  });

  it("pins to the nearest screen edge when the path is off screen", () => {
    expect(
      placeStep(
        [
          [
            [300, 40],
            [500, 40],
          ],
        ],
        box,
      ),
    ).toEqual({ point: [100, 40], pinned: true });
    expect(
      placeStep(
        [
          [
            [-50, -80],
            [-10, -20],
          ],
        ],
        box,
      ).point,
    ).toEqual([0, 0]);
  });

  it("finds the middle of a bent line by length", () => {
    expect(
      halfway([
        [0, 0],
        [30, 0],
        [30, 10],
      ]),
    ).toEqual([20, 0]);
  });

  it("places a number at an isolated on-screen portal endpoint", () => {
    expect(placeStep([[[50, 40]]], box)).toEqual({
      point: [50, 40],
      pinned: false,
    });
  });

  it("prefers an on-screen portal endpoint to an off-screen one", () => {
    expect(placeStep([[[300, 400]], [[50, 40]]], box)).toEqual({
      point: [50, 40],
      pinned: false,
    });
  });

  it("pins an isolated off-screen portal endpoint to the screen edge", () => {
    expect(placeStep([[[300, 40]]], box)).toEqual({
      point: [100, 40],
      pinned: true,
    });
  });
});

describe("step numbers clear of pins (#37)", () => {
  const half: [number, number] = [10, 10];
  const grace = {
    center: [50, 50] as [number, number],
    half: [11, 11] as [number, number],
  };
  const line: [number, number][] = [
    [0, 50],
    [100, 50],
  ];

  it("stay where they are when nothing covers them", () => {
    expect(clearOfPins([20, 50], half, line, [grace], 4)).toEqual([20, 50]);
  });

  it("slide along their path to the nearest clear spot", () => {
    const [x, y] = clearOfPins([50, 50], half, line, [grace], 4);
    expect(y).toBe(50);
    // Off the grace with a 4 px gap: 11 + 10 + 4 = 25 from its centre.
    expect(Math.abs(x - 50)).toBe(26);
  });

  it("go beside the icon when their stretch of path has no clear spot", () => {
    const short: [number, number][] = [
      [40, 50],
      [60, 50],
    ];
    expect(clearOfPins([50, 50], half, short, [grace], 4)).toEqual([50, 75]);
  });
});

describe("step numbers on the screen edge (#33)", () => {
  const edgeBox = { left: 0, top: 0, right: 200, bottom: 100 };
  const at = (x: number, y: number) => ({
    center: [x, y] as [number, number],
    half: [10, 8] as [number, number],
  });

  it("spread apart along the edge, keeping their order", () => {
    expect(
      spreadAlongEdges([at(200, 50), at(200, 50), at(0, 50)], edgeBox, 4),
    ).toEqual([
      [200, 50],
      [200, 70],
      [0, 50],
    ]);
  });

  it("stay inside the box at its end", () => {
    expect(spreadAlongEdges([at(190, 100), at(190, 100)], edgeBox, 4)).toEqual([
      [176, 100],
      [200, 100],
    ]);
    // A corner counts as the left or right edge.
    expect(spreadAlongEdges([at(200, 100), at(200, 100)], edgeBox, 4)).toEqual([
      [200, 80],
      [200, 100],
    ]);
  });
});
