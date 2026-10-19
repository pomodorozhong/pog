import { describe, expect, it } from "vitest";
import type { MapNode } from "../src/domain/types";
import {
  arrowsAlong,
  clipToBox,
  currentPath,
  lineLength,
  unfinishedPins,
} from "../src/map/pathArrows";

const box = { left: 0, top: 0, right: 1000, bottom: 1000 };

describe("direction arrows", () => {
  it("are spaced along a path, pointing the way it goes", () => {
    expect(
      arrowsAlong(
        [
          [0, 0],
          [200, 0],
          [200, 100],
        ],
        100,
        box,
      ),
    ).toEqual([
      { point: [50, 0], angle: 0 },
      { point: [150, 0], angle: 0 },
      { point: [200, 50], angle: 90 },
    ]);
    // Walked the other way, they point back.
    expect(
      arrowsAlong(
        [
          [200, 0],
          [0, 0],
        ],
        100,
        box,
      ).map((a) => a.angle),
    ).toEqual([180, 180]);
  });

  it("leave out what's off screen, and short stretches", () => {
    expect(
      arrowsAlong(
        [
          [-500, 10],
          [500, 10],
        ],
        100,
        { left: 0, top: 0, right: 200, bottom: 100 },
      ).map((a) => a.point[0]),
    ).toEqual([50, 150]);
    expect(
      arrowsAlong(
        [
          [0, 0],
          [30, 0],
        ],
        100,
        box,
      ),
    ).toEqual([]);
  });

  it("run on the path the player is on until its end, the lowest step first", () => {
    const edges = [
      { id: "a", nodes: ["x", "y"], step: 3 },
      { id: "b", nodes: ["x", "m", "z"], step: 2 },
      { id: "note", nodes: ["x"], step: null },
      { id: "c", nodes: ["y", "x"], step: 1 },
    ];
    const done = new Set<string>();
    expect(currentPath(edges, "x", done)?.id).toBe("b");
    // Partway along, the path keeps running.
    expect(currentPath(edges, "m", done)?.id).toBe("b");
    // At a path's end with nothing left on it, the path starting there runs.
    expect(currentPath(edges, "y", done)?.id).toBe("c");
    expect(currentPath(edges, "z", done)).toBeUndefined();
    expect(currentPath(edges, null, done)).toBeUndefined();
  });

  it("keep running on a path ending where the player is until it's done", () => {
    const edges = [
      { id: "first", nodes: ["s", "item", "shared"], step: 1 },
      { id: "then", nodes: ["shared", "boss"], step: 2 },
    ];
    // Something is left on the first path: it's still the one.
    expect(currentPath(edges, "shared", new Set(["item", "boss"]))?.id).toBe(
      "first",
    );
    // Done with it: the next one.
    expect(currentPath(edges, "shared", new Set(["boss"]))?.id).toBe("then");
    // Nothing left anywhere: the one starting here.
    expect(currentPath(edges, "shared", new Set())?.id).toBe("then");
  });
});

describe("moving arrows' lines", () => {
  it("keep only the parts of a line inside the box", () => {
    // In, out past the right edge, and back in.
    expect(
      clipToBox(
        [
          [500, 500],
          [1500, 500],
          [1500, 600],
          [500, 600],
        ],
        box,
      ),
    ).toEqual([
      [
        [500, 500],
        [1000, 500],
      ],
      [
        [1000, 600],
        [500, 600],
      ],
    ]);
    expect(
      clipToBox(
        [
          [-100, 100],
          [100, 100],
          [100, 300],
        ],
        box,
      ),
    ).toEqual([
      [
        [0, 100],
        [100, 100],
        [100, 300],
      ],
    ]);
    expect(
      clipToBox(
        [
          [2000, 0],
          [3000, 0],
        ],
        box,
      ),
    ).toEqual([]);
  });

  it("measure a line", () => {
    expect(
      lineLength([
        [0, 0],
        [3, 4],
        [3, 10],
      ]),
    ).toBe(11);
  });
});

describe("pins with something left to do", () => {
  it("are undiscovered graces, bosses not beaten and needed entries", () => {
    const pin = (id: string, bosses?: string[]) =>
      ({ id, kind: "item", layer: "overworld", x: 0, y: 0, bosses }) as MapNode;
    expect(
      [
        ...unfinishedPins(
          [pin("beaten", ["boss/1"]), pin("alive", ["boss/1", "boss/2"])],
          new Set(["grace/1"]),
          new Set(["boss/1"]),
          [
            { pin: "wanted", status: "needed" },
            { pin: "got", status: "acquired" },
            { pin: "passed", status: "skipped" },
          ],
        ),
      ].sort(),
    ).toEqual(["alive", "grace/1", "wanted"]);
  });
});
