import { callApp } from "../../server/mcp.ts";
import { MAP, openApp } from "./app";
import { expect, test } from "./fixtures";

const BASE = "http://127.0.0.1:5198";

test("an agent's proposal changes nothing until the player applies it", async ({
  page,
  browser,
  saved,
}) => {
  await expect(callApp(BASE, "get_wishlist", {})).rejects.toThrow("isn't open");
  await openApp(page);
  const [moonveil] = (await callApp(BASE, "search_items", {
    query: "Moonveil",
  })) as { id: string }[];
  const proposed = (await callApp(BASE, "add_to_wishlist", {
    item: moonveil.id,
    near_grace: "Gatefront",
    note: "Gatefront ruins cellar",
  })) as { proposal: string };

  const button = page.getByRole("button", { name: "Agent changes 1" });
  await expect(button).toBeVisible();
  expect((await saved("player")).profiles[0].wishlist).toEqual([]);

  // The mirror shows the review too.
  const context = await browser.newContext();
  const mirror = await context.newPage();
  await mirror.goto("/?mode=mirror");
  await button.click();
  const review = page.getByRole("region", { name: "Agent changes" });
  await expect(
    review.getByText("Add Moonveil on a new pin near Gatefront"),
  ).toBeVisible();
  await expect(
    mirror
      .getByRole("region", { name: "Agent changes" })
      .getByText("Add Moonveil on a new pin near Gatefront"),
  ).toBeVisible();
  await context.close();

  await review.getByRole("button", { name: "Apply" }).click();
  await expect(button).toBeHidden();
  await expect
    .poll(async () => (await saved("player"))?.profiles[0].wishlist)
    .toEqual([
      expect.objectContaining({
        item: moonveil.id,
        note: "Gatefront ruins cellar",
      }),
    ]);
  const entry = (await saved("player")).profiles[0].wishlist[0];
  await expect
    .poll(async () => (await saved(MAP))?.nodes)
    .toEqual([
      expect.objectContaining({ id: entry.pin, items: [moonveil.id] }),
    ]);
  expect(
    await callApp(BASE, "get_proposal_status", { ids: [proposed.proposal] }),
  ).toEqual([{ id: proposed.proposal, status: "applied" }]);

  // Undo takes the new pin back off the map.
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect.poll(async () => (await saved(MAP))?.nodes).toEqual([]);
});
