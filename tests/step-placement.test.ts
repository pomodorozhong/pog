import { describe, expect, it } from "vitest";
import { halfway, placeStep } from "../src/map/stepPlacement";

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
    ).toEqual({ point: [50, 50], pinned: false });
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
    ).toEqual({ point: [75, 20], pinned: false });
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
