import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

export const MAP = "maps/profile-1";

/** A point on the map, in pixels from the center of the map area. */
async function onMap(page: Page, dx: number, dy: number) {
  const box = await page.locator(".leaflet-container").boundingBox();
  if (!box) throw new Error("The map isn't showing.");
  return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
}

export async function placePin(page: Page, dx: number, dy: number) {
  // Narrow windows name the tools without their keys.
  await page.getByRole("button", { name: /^Pin( N)?$/ }).click();
  const { x, y } = await onMap(page, dx, dy);
  await page.mouse.click(x, y);
  await expect(
    page.getByRole("region", { name: "Selected node" }),
  ).toBeVisible();
}

export async function clickMap(page: Page, dx: number, dy: number) {
  const { x, y } = await onMap(page, dx, dy);
  await page.mouse.click(x, y);
}

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Playthrough tracker" }),
  ).toBeVisible();
}
