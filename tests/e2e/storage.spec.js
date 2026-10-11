import { expect, test } from '@playwright/test';
import { expectTapTargets } from './helpers.js';
import { PLAN } from './planner-helpers.js';

const alert = page => page.getByRole('alert').filter({ hasText: /browser|version|storage/i });

test('STOR-1: a full storage is reported and the page keeps working', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
  });
  await page.goto('/index.html');
  await page.getByLabel('Monthly salary').fill('1000');
  await expect(alert(page)).toContainText('storage is full');
  await expect(page.getByRole('region', { name: 'Balance summary' })).toContainText(
    'Cash after 12 months: 12000.00',
  );
});

test('STOR-1: storage that is not available is reported on load', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await page.goto('/index.html');
  await expect(alert(page)).toContainText('does not allow saving');
  await page.getByLabel('Monthly salary').fill('1000');
  await expect(page.getByRole('region', { name: 'Balance summary' })).toContainText('12000.00');
});

test('STOR-2: a value from a newer version is left alone and the person is told', async ({
  page,
}) => {
  await page.goto('/index.html');
  await page.evaluate(() =>
    localStorage.setItem('budget-planner:planner', JSON.stringify({ version: 9, data: 'future' })),
  );
  await page.reload();
  await page.getByLabel('Monthly salary').fill('1000');
  await expect(alert(page)).toContainText('newer version');
  const stored = await page.evaluate(() => localStorage.getItem('budget-planner:planner'));
  expect(JSON.parse(stored)).toEqual({ version: 9, data: 'future' });
});

test('STOR-2: an unreadable value does not stop the page', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.setItem('budget-planner:planner', '{not json'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Planner' })).toBeVisible();
  await expect(page.getByLabel('Monthly salary')).toHaveValue('0.00');
});

for (const path of ['/index.html', '/import.html']) {
  test(`STOR-3: ${path} can clear all data, after a confirmation`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(plan => {
      localStorage.setItem('budget-planner:planner', JSON.stringify({ version: 1, data: plan }));
      localStorage.setItem('budget-planner:backup:config', '{}');
      localStorage.setItem('other-app:keep', 'yes');
    }, PLAN);
    await page.reload();

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Clear all');
      return dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Clear all data' }).click();
    expect(
      await page.evaluate(() => localStorage.getItem('budget-planner:planner')),
    ).not.toBeNull();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Clear all data' }).click();
    await page.waitForLoadState('load');
    await expect
      .poll(() => page.evaluate(() => Object.keys(localStorage).sort()))
      .toEqual(['other-app:keep']);
  });
}

test('STOR-3: after clearing, the planner starts empty', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByLabel('Monthly salary').fill('1000');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear all data' }).click();
  await expect(page.getByLabel('Monthly salary')).toHaveValue('0.00');
});

test('GEN-1: the footer button is a full-size tap target', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone project only');
  await page.goto('/index.html');
  await expectTapTargets(page);
});
