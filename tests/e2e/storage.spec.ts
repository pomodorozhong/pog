import { expect, test } from "./fixtures";
import { MAP, openApp, placePin } from "./app";

test("an edit saved through the dev server shows in another browser on the preview server", async ({
  page,
  browser,
  saved,
}) => {
  await openApp(page);
  await placePin(page, -120, -80);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);

  const other = await (await browser.newContext()).newPage();
  await other.goto("http://127.0.0.1:5199");
  await other.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(other.getByRole("region", { name: "This map" })).toContainText(
    "1 nodes and 0 paths",
  );
});

test("a window with an older copy can't overwrite a newer save", async ({
  page,
  browser,
  saved,
}) => {
  const other = await (await browser.newContext()).newPage();
  await openApp(other);
  await openApp(page);
  await placePin(page, -120, -80);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);
  const first = (await saved(MAP)).nodes[0].id;

  await placePin(other, 100, 60);
  await expect(other.getByRole("status").first()).toHaveText(
    "Saved data changed in another window. Reload before saving again.",
  );
  expect((await saved(MAP)).nodes.map((n: { id: string }) => n.id)).toEqual([
    first,
  ]);

  // After a reload it shows the newer save and can save again.
  await other.reload();
  await placePin(other, 100, 60);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(2);
});

test("undoing back to the map as loaded saves it", async ({ page, saved }) => {
  await openApp(page);
  await placePin(page, -120, -80);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(0);
});
