import { expect, test } from '@playwright/test';
import { PAGES, expectNoHorizontalOverflow } from './helpers.js';

for (const path of PAGES) {
  test.describe(path, () => {
    test('nav links to both pages and marks the current one', async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole('navigation', { name: 'Pages' });
      await expect(nav.getByRole('link')).toHaveCount(2);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    });

    test('header stays visible after scrolling', async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => {
        document.body.style.minHeight = '3000px';
        window.scrollTo(0, 1000);
      });
      await expect(page.locator('.site-header')).toBeInViewport();
    });

    test('no horizontal overflow at 320 px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });

    test('dark scheme redefines the background token', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(path);
      const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await page.emulateMedia({ colorScheme: 'dark' });
      const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(dark).not.toBe(light);
    });
  });
}

test('popover opens by tap or click and closes on Escape', async ({ page }) => {
  await page.goto('/import.html');
  const trigger = page.getByRole('button', { name: 'About this step' });
  const body = page.locator('#tip-file');
  await expect(body).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(body).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(body).toBeHidden();
});
