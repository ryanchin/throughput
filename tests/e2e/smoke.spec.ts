import { test, expect } from "@playwright/test";

test("homepage loads with 200 status", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("text=AAVA")).toBeVisible();
  await expect(page.locator("text=Throughput")).toBeVisible();
});
