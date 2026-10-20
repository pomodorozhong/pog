import { expect, test } from "./fixtures";
import { MAP, openApp, placePin } from "./app";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("at phone width, editing is a tab of the bottom sheet", async ({
  page,
  saved,
}) => {
  await openApp(page);
  const tools = page.getByRole("toolbar", { name: "Map tools" });
  await expect(tools).toBeHidden();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(tools).toBeVisible();
  await placePin(page, 0, -60);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);

  await page.getByRole("button", { name: "Done" }).click();
  await expect(tools).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Playthrough tracker" }),
  ).toBeVisible();
});
