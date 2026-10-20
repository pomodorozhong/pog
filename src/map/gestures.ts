import L from "leaflet";

/** Zoom levels per pixel of pinch or wheel movement. */
const PINCH_SPEED = 0.012;
const WHEEL_SPEED = 0.004;
/** Share of the remaining distance to the target zoom covered each frame. */
const EASING = 0.28;

/**
 * A mouse wheel moves in coarse, vertical-only notches; a trackpad scrolls in
 * fine steps on both axes. Browsers report notches in lines, or as multiples
 * of 120 in the legacy `wheelDelta`.
 */
export function isMouseWheel(event: WheelEvent): boolean {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
  const legacy = (event as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
  return (
    event.deltaX === 0 &&
    legacy !== undefined &&
    legacy !== 0 &&
    legacy % 120 === 0
  );
}

const pixels = (event: WheelEvent, delta: number) =>
  event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? delta * 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? delta * 400
      : delta;

/**
 * Trackpad gestures for a Leaflet map: two-finger scroll pans, pinch zooms
 * around the fingers, and a mouse wheel zooms around the cursor. Zoom eases
 * toward its target every frame, so both feel continuous. Touch screens keep
 * Leaflet's own drag and pinch handling.
 */
export function enableGestures(map: L.Map): () => void {
  const container = map.getContainer();
  let target: number | null = null;
  let anchor = L.point(0, 0);
  let frame = 0;

  // Leaflet's own touch pinch moves the view with `pinch: true`: tile layers
  // then scale the tiles they have and keep them until the new level loads,
  // instead of resetting (and blanking) on every frame. The same private
  // calls are used here; the gesture ends with a normal zoom so old tiles are
  // pruned and listeners see zoomend/moveend once.
  const internal = map as unknown as {
    _move(center: L.LatLng, zoom: number, data?: object): void;
    _moveEnd(zoomChanged: boolean): void;
  };
  let zooming = false;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const step = () => {
    frame = 0;
    if (target === null) return;
    const current = map.getZoom();
    const next =
      Math.abs(target - current) < 0.002
        ? target
        : current + (target - current) * EASING;
    // Keep the point under the fingers (or cursor) fixed, as setZoomAround does.
    const half = map.getSize().divideBy(2);
    const offset = anchor
      .subtract(half)
      .multiplyBy(1 - 1 / map.getZoomScale(next, current));
    const center = map.containerPointToLatLng(half.add(offset));
    zooming = true;
    internal._move(center, next, { pinch: true, round: false });
    if (next === target) {
      target = null;
      // A pinch arrives in bursts; finish only once it has really stopped.
      settle = setTimeout(finish, 120);
    } else frame = requestAnimationFrame(step);
  };

  const finish = () => {
    clearTimeout(settle);
    if (!zooming) return;
    zooming = false;
    map.fire("zoom");
    internal._moveEnd(true);
  };

  const zoomBy = (amount: number, at: L.Point) => {
    const base = target ?? map.getZoom();
    target = Math.min(
      map.getMaxZoom(),
      Math.max(map.getMinZoom(), base + amount),
    );
    anchor = at;
    clearTimeout(settle);
    if (!frame) frame = requestAnimationFrame(step);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const at = map.mouseEventToContainerPoint(event as unknown as MouseEvent);
    const dy = pixels(event, event.deltaY);
    if (event.ctrlKey) zoomBy(-dy * PINCH_SPEED, at);
    else if (isMouseWheel(event)) zoomBy(-dy * WHEEL_SPEED, at);
    else {
      if (target !== null) {
        target = null;
        cancelAnimationFrame(frame);
        frame = 0;
        finish();
      }
      map.panBy([pixels(event, event.deltaX), dy], { animate: false });
    }
  };
  // Safari also sends its own gesture events for a pinch; stop it zooming the page.
  const stopPageZoom = (event: Event) => event.preventDefault();

  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("gesturestart", stopPageZoom);
  container.addEventListener("gesturechange", stopPageZoom);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(settle);
    container.removeEventListener("wheel", onWheel);
    container.removeEventListener("gesturestart", stopPageZoom);
    container.removeEventListener("gesturechange", stopPageZoom);
  };
}

/**
 * Move a map to views that arrive many times a second, such as a mirror
 * following the app's zoom, without blanking tiles: each step moves the
 * view as a pinch does, and once the steps stop the map settles with one
 * zoomend/moveend.
 */
export function followViews(map: L.Map) {
  const internal = map as unknown as {
    _move(center: L.LatLng, zoom: number, data?: object): void;
    _moveEnd(zoomChanged: boolean): void;
  };
  let moving = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (!moving) return;
    moving = false;
    map.fire("zoom");
    internal._moveEnd(true);
  };
  return {
    moveTo(center: L.LatLng, zoom: number) {
      clearTimeout(settle);
      moving = true;
      internal._move(center, zoom, { pinch: true, round: false });
      settle = setTimeout(finish, 150);
    },
    dispose() {
      clearTimeout(settle);
    },
  };
}
