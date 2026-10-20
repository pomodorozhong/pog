import { expect, test } from "./fixtures";
import { clickMap, MAP, openApp, placePin } from "./app";

test("a pin placed on the map is saved and comes back after a reload", async ({
  page,
  saved,
}) => {
  await openApp(page);
  await placePin(page, -120, -80);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);
  const [pin] = (await saved(MAP)).nodes;
  expect(pin).toMatchObject({ kind: "junction", layer: "overworld" });

  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("region", { name: "This map" })).toContainText(
    "1 nodes and 0 paths",
  );
});

test("a path drawn through two pins is saved", async ({ page, saved }) => {
  await openApp(page);
  await placePin(page, -120, -80);
  await placePin(page, 100, 60);
  await page.getByRole("button", { name: "Draw path P" }).click();
  await clickMap(page, -120, -80);
  await clickMap(page, 100, 60);
  // The first Esc ends the path, the second clears the selection.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await expect.poll(async () => (await saved(MAP))?.edges.length).toBe(1);
  const map = await saved(MAP);
  expect(map.edges[0].nodes).toEqual(
    map.nodes.map((n: { id: string }) => n.id),
  );
  await expect(page.getByRole("region", { name: "This map" })).toContainText(
    "2 nodes and 1 paths",
  );
});

test("undo and redo change the map and what is saved", async ({
  page,
  saved,
}) => {
  await openApp(page);
  await placePin(page, -120, -80);
  await placePin(page, 100, 60);
  await page.getByRole("button", { name: "Draw path P" }).click();
  await clickMap(page, -120, -80);
  await clickMap(page, 100, 60);
  // The first Esc ends the path, the second clears the selection.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const counts = async () => {
    const map = await saved(MAP);
    return map && [map.nodes.length, map.edges.length];
  };
  await expect.poll(counts).toEqual([2, 1]);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(counts).toEqual([2, 0]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(counts).toEqual([1, 0]);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(counts).toEqual([2, 0]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "This map" })).toContainText(
    "2 nodes and 0 paths",
  );
});

test("each playthrough keeps its own map", async ({ page, saved }) => {
  await openApp(page);
  await placePin(page, -120, -80);
  await expect.poll(async () => (await saved(MAP))?.nodes.length).toBe(1);

  const switcher = page.getByRole("combobox", { name: "Playthrough" });
  await switcher.selectOption({ label: "New playthrough…" });
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("region", { name: "This map" })).toContainText(
    "0 nodes and 0 paths",
  );
  await placePin(page, 100, 60);
  await placePin(page, 140, -60);
  await expect
    .poll(async () => (await saved("player"))?.profiles.length)
    .toBe(2);
  const second = (await saved("player")).activeProfile;
  expect(second).not.toBe("profile-1");
  await expect
    .poll(async () => (await saved(`maps/${second}`))?.nodes.length)
    .toBe(2);

  await switcher.selectOption({ index: 0 });
  await expect(page.getByRole("region", { name: "This map" })).toContainText(
    "1 nodes and 0 paths",
  );
  expect((await saved(MAP)).nodes).toHaveLength(1);
});

test("an item found by its English or zh-TW name goes on the wishlist", async ({
  page,
  saved,
}) => {
  await openApp(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const wishlist = page.getByRole("region", { name: "Wishlist" });
  await wishlist
    .getByRole("textbox", { name: "Add to wishlist" })
    .fill("Moonveil");
  await wishlist.getByRole("button", { name: /Moonveil/ }).click();
  const wished = async () =>
    (await saved("player")).profiles[0].wishlist.map(
      (w: { item: string }) => w.item,
    );
  await expect.poll(wished).toEqual(["weapon/9060000"]);

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("combobox", { name: "Language" }).selectOption("zh-TW");
  await page.keyboard.press("Escape");
  const list = page.getByRole("region", { name: "願望清單" });
  await list.getByRole("textbox").fill("屍山血海");
  await list.getByRole("button", { name: /屍山血海/ }).click();
  await expect.poll(wished).toEqual(["weapon/9060000", "weapon/9040000"]);
  await expect(list).toContainText("2 個需要");
});
