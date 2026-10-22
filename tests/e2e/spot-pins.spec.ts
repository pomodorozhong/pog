import { expect, test } from "./fixtures";
import { MAP, openApp } from "./app";

test("a wishlisted item's pin is placed on its spot from the game data", async ({
  page,
  saved,
}) => {
  await openApp(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Add to wishlist" })
    .fill("Flask of Wondrous Physick");
  // The catalog has the flask twice; the first match is the one placed on the map.
  await page
    .getByRole("button", { name: /^Flask of Wondrous Physick/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Place pin from game data" }).click();

  await expect(
    page.getByRole("region", { name: "Selected node" }),
  ).toContainText("Flask of Wondrous Physick");
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);
  const [pin] = (await saved(MAP)).nodes;
  const catalog = await (
    await page.request.get("/game-data/catalog.json")
  ).json();
  const [spot] = catalog.pickups.filter((p: { items: string[] }) =>
    p.items.includes(pin.items[0]),
  );
  expect(pin).toMatchObject({ layer: spot.layer, x: spot.x, y: spot.y });
  await expect
    .poll(async () => (await saved("player"))?.profiles[0].wishlist)
    .toEqual([{ item: pin.items[0], status: "needed", note: "", pin: pin.id }]);
});

test("an item with several spots gets its pin on the one chosen on the map", async ({
  page,
  saved,
}) => {
  await openApp(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Add to wishlist" })
    .fill("Golden Seed");
  await page.getByRole("button", { name: /^Golden Seed/ }).click();
  await page
    .getByRole("button", { name: /Place pin from game data \(\d+ spots\)/ })
    .click();
  await expect(page.getByText(/Choose one of the \d+ spots/)).toBeVisible();
  const choices = page.locator(".item-spot.is-choosable");
  await expect.poll(() => choices.count()).toBeGreaterThan(10);
  await choices.first().click();

  await expect(page.getByText(/Choose one of the \d+ spots/)).toBeHidden();
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);
  expect((await saved(MAP)).nodes[0].items).toHaveLength(1);
});
