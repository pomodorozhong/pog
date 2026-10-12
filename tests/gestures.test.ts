import { describe, expect, it } from "vitest";
import { isMouseWheel } from "../src/map/gestures";

const wheel = (init: WheelEventInit, wheelDeltaY?: number) => {
  const event = new WheelEvent("wheel", init);
  if (wheelDeltaY !== undefined)
    Object.defineProperty(event, "wheelDeltaY", { value: wheelDeltaY });
  return event;
};

describe("wheel source", () => {
  it("treats line-based or 120-notch scrolling as a mouse wheel", () => {
    expect(isMouseWheel(wheel({ deltaY: 3, deltaMode: 1 }))).toBe(true);
    expect(isMouseWheel(wheel({ deltaY: 100 }, -120))).toBe(true);
  });

  it("treats fine or two-axis pixel scrolling as a trackpad", () => {
    expect(isMouseWheel(wheel({ deltaY: 4 }, -12))).toBe(false);
    expect(isMouseWheel(wheel({ deltaX: 2, deltaY: 40 }, -120))).toBe(false);
    expect(isMouseWheel(wheel({ deltaY: 4 }))).toBe(false);
  });
});
