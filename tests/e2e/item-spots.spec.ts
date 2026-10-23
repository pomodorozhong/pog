import { expect, test } from "./fixtures";
import { openApp } from "./app";

test("the game's item spots show on the map as chosen, and the choice is saved", async ({
  page,
  saved,
}) => {
  await openApp(page);
  const spots = page.locator(".item-spot");
  // Wishlist items is the default, and the wishlist is empty.
  await expect(spots).toHaveCount(0);

  await page.getByRole("button", { name: "Details" }).click();
  const choice = page.getByRole("combobox", { name: "Item spots" });
  await expect(choice).toHaveValue("wishlist");
  await choice.selectOption("all");
  await expect.poll(() => spots.count()).toBeGreaterThan(1000);
  await expect.poll(async () => (await saved("player"))?.itemSpots).toBe("all");

  // Hovering a spot names what it gives.
  await spots.first().hover({ force: true });
  await expect(page.locator(".node-label--spot")).not.toBeEmpty();

  await choice.selectOption("off");
  await expect(spots).toHaveCount(0);
});
