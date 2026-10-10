import { test } from '@playwright/test';
import {
  BREAKPOINT,
  PAGES,
  expectColumns,
  expectNoHorizontalOverflow,
  expectTapTargets,
} from './helpers.js';

// These run on both projects; the tap-target check only applies to the phone project (GEN-1).
for (const path of PAGES) {
  test.describe(path, () => {
    test('no horizontal overflow at 320, 375 and 1440 px', async ({ page }) => {
      await page.goto(path);
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await expectNoHorizontalOverflow(page);
      }
    });

    test('interactive elements are at least 44 px on the phone', async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'phone project only');
      await page.goto(path);
      await expectTapTargets(page);
    });

    test('one column below the breakpoint, two from it', async ({ page }) => {
      await page.goto(path);
      for (const [width, columns] of [
        [375, 1],
        [768, 1],
        [BREAKPOINT - 1, 1],
        [BREAKPOINT, 2],
        [1440, 2],
      ]) {
        await page.setViewportSize({ width, height: 900 });
        await expectColumns(page, columns);
      }
    });
  });
}
