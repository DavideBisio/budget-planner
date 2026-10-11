import { expect, test } from '@playwright/test';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const files = page => page.getByRole('list', { name: 'Imported files' }).getByRole('listitem');

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await expect(files(page)).toHaveCount(2);
});

test('STOR-1, ENG-10: imported files are still there after a reload', async ({ page }) => {
  await page.reload();
  await page.getByRole('button', { name: /^Import/ }).click();
  await expect(files(page)).toHaveCount(2);
  await expect(page.locator('#result-empty')).toBeHidden();
});

test('STOR-1: a removed file stays removed after a reload', async ({ page }) => {
  await files(page)
    .first()
    .getByRole('button', { name: /^Remove/ })
    .click();
  await expect(files(page)).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /^Import/ }).click();
  await expect(files(page)).toHaveCount(1);
});

test('STOR-1: the stored files are versioned and hold raw text only', async ({ page }) => {
  const stored = JSON.parse(
    await page.evaluate(() => localStorage.getItem('budget-planner:files')),
  );
  expect(stored.version).toBe(1);
  expect(stored.data).toHaveLength(2);
  expect(Object.keys(stored.data[0]).sort()).toEqual(['name', 'text']);
});

test('STOR-3: clearing all data also forgets the files', async ({ page }) => {
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear all data' }).click();
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: /^Import/ }).click();
  await expect(files(page)).toHaveCount(0);
});

test('STOR-1: files that cannot be stored do not stop the import', async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
  });
  await page.getByLabel('Statement files').setInputFiles([JAN]);
  await expect(page.getByRole('alert').filter({ hasText: 'storage is full' })).toBeVisible();
  await expect(files(page)).toHaveCount(3);
});
