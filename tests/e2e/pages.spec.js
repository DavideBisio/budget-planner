import { expect, test } from '@playwright/test';

for (const [path, heading] of [
  ['/index.html', 'Planner'],
  ['/import.html', 'Import'],
]) {
  test(`${path} renders its heading`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  });
}
