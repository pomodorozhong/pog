import type { SharedStore } from "./shared";
import type { ScrollPosition } from "./types";

/**
 * Scrolling panels carry `data-scroll-sync="<name>"`. A viewer lays out at its
 * own size, so a panel follows the operator's by entry (the nth list item or
 * section in it) and how far through that entry its top is, not by pixels.
 */
const SCROLL_ATTRIBUTE = "data-scroll-sync";
const ENTRIES = "li, section";
export const scrollKey = (name: string) => `scroll:${name}`;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const range = (panel: HTMLElement) =>
  Math.max(0, panel.scrollHeight - panel.clientHeight);

export function capturePosition(panel: HTMLElement): ScrollPosition {
  const top = panel.getBoundingClientRect().top;
  const entries = [...panel.querySelectorAll<HTMLElement>(ENTRIES)];
  let anchor: number | null = null;
  entries.forEach((entry, index) => {
    if (entry.getBoundingClientRect().top <= top + 1) anchor = index;
  });
  const rect = anchor === null ? null : entries[anchor].getBoundingClientRect();
  return {
    anchor,
    fraction: rect ? clamp((top - rect.top) / Math.max(1, rect.height)) : 0,
    page: range(panel) ? clamp(panel.scrollTop / range(panel)) : 0,
  };
}

export function restorePosition(panel: HTMLElement, position: ScrollPosition) {
  const entry =
    position.anchor === null
      ? undefined
      : panel.querySelectorAll<HTMLElement>(ENTRIES)[position.anchor];
  // Nothing scrolled at the operator: stay at the top.
  if (!entry || (position.anchor === 0 && position.page === 0)) {
    panel.scrollTop = position.page * range(panel);
    return;
  }
  const offset =
    entry.getBoundingClientRect().top - panel.getBoundingClientRect().top;
  panel.scrollTop +=
    offset + position.fraction * entry.getBoundingClientRect().height;
}

/**
 * Record where every panel on the operator's screen is scrolled to, and forget
 * panels that are gone, so one that opens again starts at the top for viewers
 * too. Runs on every scroll and after every render.
 */
export function captureScrolling(store: SharedStore) {
  const shown = new Set<string>();
  for (const panel of document.querySelectorAll<HTMLElement>(
    `[${SCROLL_ATTRIBUTE}]`,
  )) {
    const key = scrollKey(panel.getAttribute(SCROLL_ATTRIBUTE)!);
    shown.add(key);
    const position = capturePosition(panel);
    const before = store.get(key) as ScrollPosition | undefined;
    if (
      !before ||
      before.anchor !== position.anchor ||
      before.fraction !== position.fraction ||
      before.page !== position.page
    )
      store.set(key, position);
  }
  for (const key of Object.keys(store.values()))
    if (key.startsWith("scroll:") && !shown.has(key)) store.delete(key);
}

/** The operator's window shares where each panel is scrolled to. */
export function shareScrolling(store: SharedStore) {
  const onScroll = (event: Event) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.hasAttribute(SCROLL_ATTRIBUTE)
    )
      captureScrolling(store);
  };
  // Scroll events don't bubble; listening while capturing sees every panel.
  document.addEventListener("scroll", onScroll, true);
  return () => document.removeEventListener("scroll", onScroll, true);
}

/** A viewer scrolls every panel it shows to where the operator's is. */
export function followScrolling(store: SharedStore) {
  for (const panel of document.querySelectorAll<HTMLElement>(
    `[${SCROLL_ATTRIBUTE}]`,
  )) {
    const position = store.get(
      scrollKey(panel.getAttribute(SCROLL_ATTRIBUTE)!),
    ) as ScrollPosition | undefined;
    restorePosition(panel, position ?? { anchor: null, fraction: 0, page: 0 });
  }
}
