import type { Browser, Page } from "@playwright/test";
import { MAP, onMap, openApp, placePin } from "./app";
import { expect, test } from "./fixtures";

/** A viewer in its own browser, as OBS is, recording anything it sends. */
async function openViewer(
  browser: Browser,
  size = { width: 1600, height: 1000 },
  base = "",
) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  const writes: string[] = [];
  const frames: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => frames.push(String(frame.payload))),
  );
  await page.goto(`${base}/?mode=viewer`);
  await following(page);
  return { page, context, writes, frames };
}

const following = (page: Page) =>
  expect(page.locator("html")).toHaveAttribute("data-operator", "on");

/** How far apart the selected pin is on the two maps, in pixels. */
async function pinGap(one: Page, other: Page) {
  const where = async (page: Page) => {
    const map = await page.locator(".leaflet-container").boundingBox();
    const pin = await page.locator(".map-node.is-selected").boundingBox();
    return map && pin ? [pin.x - map.x, pin.y - map.y] : [NaN, NaN];
  };
  const [a, b] = [await where(one), await where(other)];
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Which entry of a panel is at its top, as `capturePosition` counts them. */
const topEntry = (page: Page, name: string) =>
  page.locator(`[data-scroll-sync="${name}"]`).evaluate((panel) => {
    const top = panel.getBoundingClientRect().top;
    let index = -1;
    panel.querySelectorAll("li, section").forEach((entry, k) => {
      if (entry.getBoundingClientRect().top <= top + 1) index = k;
    });
    return index;
  });

test("a viewer follows the operator's screen and never changes anything", async ({
  page,
  browser,
  saved,
}) => {
  await openApp(page);
  const viewer = await openViewer(browser);
  const shows = viewer.page;

  // Panels and what is selected.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    shows.getByRole("region", { name: "Playthrough" }),
  ).toBeVisible();
  await placePin(page, -120, -80);
  await expect(
    shows.getByRole("region", { name: "Selected node" }),
  ).toBeVisible();
  await expect(shows.locator(".map-node.is-selected")).toHaveCount(1);

  // The map, while it moves and once it settles.
  const { x, y } = await onMap(page, 0, 0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y + 90, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => pinGap(page, shows)).toBeLessThan(2);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => pinGap(page, shows)).toBeLessThan(2);

  // Menus, and the language.
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(
    shows.getByRole("region", { name: "Viewer link" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("zh-TW");
  await expect(shows.getByRole("region", { name: "觀看連結" })).toBeVisible();

  // A reload catches up at once.
  await shows.reload();
  await expect(shows.getByRole("region", { name: "觀看連結" })).toBeVisible();
  await expect(shows.getByRole("region", { name: "選取的節點" })).toBeVisible();

  // Clicks and keys on the viewer do nothing.
  await shows.keyboard.press("Escape");
  await shows.keyboard.press("n");
  const spot = await onMap(shows, 100, 60);
  await shows.mouse.click(spot.x, spot.y);
  await expect(shows.getByRole("region", { name: "選取的節點" })).toBeVisible();
  await expect(page.getByRole("region", { name: "選取的節點" })).toBeVisible();
  expect((await saved(MAP)).nodes).toHaveLength(1);
  expect(viewer.writes).toEqual([]);
  expect(viewer.frames).toEqual([]);
  await viewer.context.close();
});

test("panels follow the same entry in a viewer of another size", async ({
  page,
  browser,
}) => {
  await openApp(page);
  await page
    .getByRole("combobox", { name: "Playthrough" })
    .selectOption({ label: "New playthrough…" });
  await page
    .getByRole("combobox", { name: "Start from" })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create" }).click();
  const viewer = await openViewer(browser, { width: 1100, height: 700 });
  const shows = viewer.page;
  await page
    .getByRole("region", { name: "Wishlist" })
    .getByRole("button", { name: /Notes and status/ })
    .click();
  await expect(shows.getByRole("region", { name: "Wishlist" })).toContainText(
    "Great Stars",
  );

  const panel = page.locator('[data-scroll-sync="inspector"]');
  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2;
  });
  const entry = await topEntry(page, "inspector");
  expect(entry).toBeGreaterThan(3);
  await expect.poll(() => topEntry(shows, "inspector")).toBe(entry);

  // The viewer's own window changes size: it keeps to the same entry.
  await shows.setViewportSize({ width: 900, height: 600 });
  await expect.poll(() => topEntry(shows, "inspector")).toBe(entry);
  await viewer.context.close();
});

test("a viewer keeps the last screen when the operator's window closes, and catches up after going offline", async ({
  browser,
}) => {
  const operator = await (await browser.newContext()).newPage();
  await openApp(operator);
  const viewer = await openViewer(browser);
  const shows = viewer.page;
  await operator.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    shows.getByRole("region", { name: "Playthrough" }),
  ).toBeVisible();

  await viewer.context.setOffline(true);
  await expect(shows.locator("html")).toHaveAttribute(
    "data-live",
    "disconnected",
  );
  await operator.getByRole("button", { name: "Done" }).click();
  await viewer.context.setOffline(false);
  await expect(
    shows.getByRole("region", { name: "Playthrough tracker" }),
  ).toBeVisible();

  await operator.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    shows.getByRole("region", { name: "Playthrough" }),
  ).toBeVisible();
  await operator.close();
  await expect(shows.locator("html")).toHaveAttribute("data-operator", "off");
  await expect(
    shows.getByRole("region", { name: "Playthrough" }),
  ).toBeVisible();
  await viewer.context.close();
});

test("the preview server relays to viewers too", async ({ page, browser }) => {
  const preview = "http://127.0.0.1:5199";
  await page.goto(preview);
  await expect(
    page.getByRole("region", { name: "Playthrough tracker" }),
  ).toBeVisible();
  const viewer = await openViewer(browser, undefined, preview);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    viewer.page.getByRole("region", { name: "Playthrough" }),
  ).toBeVisible();
  await viewer.context.close();
});

test("the viewer's map never goes blank while the operator zooms", async ({
  page,
  browser,
}) => {
  await openApp(page);
  const viewer = await openViewer(browser);
  const shows = viewer.page;
  await expect(shows.locator("img.leaflet-tile-loaded").first()).toBeVisible();
  // Count the loaded tiles on screen in every frame the viewer draws.
  await shows.evaluate(() => {
    const counts: number[] = [];
    (window as unknown as { tileCounts: number[] }).tileCounts = counts;
    const count = () => {
      counts.push(
        [...document.querySelectorAll("img.leaflet-tile-loaded")].filter(
          (tile) => {
            const box = tile.getBoundingClientRect();
            return box.width > 0 && box.right > 0 && box.left < innerWidth;
          },
        ).length,
      );
      requestAnimationFrame(count);
    };
    count();
  });
  const { x, y } = await onMap(page, 0, 0);
  await page.mouse.move(x, y);
  for (const notch of [-120, -120, -120, -120, 120, 120, 120, 120]) {
    await page.mouse.wheel(0, notch);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1000);
  const counts = await shows.evaluate(
    () => (window as unknown as { tileCounts: number[] }).tileCounts,
  );
  expect(counts.length).toBeGreaterThan(30);
  expect(Math.min(...counts)).toBeGreaterThan(0);
  await viewer.context.close();
});
