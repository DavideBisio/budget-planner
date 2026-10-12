import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = page => page.locator('#result-filtering');
const badge = page => page.getByRole('tab', { name: /^Filtering/ }).locator('.badge');
const ownList = page =>
  page.getByRole('group', { name: 'Own-account transfer patterns', exact: true });
const excludeList = page => page.getByRole('group', { name: 'Exclusion patterns', exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.getByRole('tab', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await page.getByRole('tab', { name: /^Filtering/ }).click();
});

test('IMP-6: shows how much data there is and keeps everything by default', async ({ page }) => {
  await expect(page.getByText('Your files cover 2026-01-02 to 2026-02-04')).toBeVisible();
  await expect(card(page)).toContainText('5 of 5 rows kept');
});

test('IMP-6: a date range removes rows outside it and shows examples', async ({ page }) => {
  await page.getByLabel('First day to keep').fill('2026-02-01');
  await expect(card(page)).toContainText('2 of 5 rows kept');
  await expect(card(page)).toContainText('Outside the date range: 3 rows removed');
  await card(page).getByText('Outside the date range').click();
  await expect(card(page).getByText('Payroll Example Corp ref JAN')).toBeVisible();
  await page.getByLabel('Last day to keep').fill('2026-02-02');
  await expect(card(page)).toContainText('1 of 5 rows kept');
});

test('IMP-6: an exclusion pattern shows how many rows it removes', async ({ page }) => {
  await page.getByRole('button', { name: 'Add an exclusion pattern' }).click();
  const item = excludeList(page).locator('.pattern-item');
  await item.getByLabel('Text to look for').fill('landlord');
  await expect(item).toContainText('Removes 2 rows');
  await expect(card(page)).toContainText('3 of 5 rows kept');
  await expect(card(page)).toContainText('Excluded by a pattern: 2 rows removed');
  await item.getByRole('button', { name: 'Remove Exclusion patterns 1' }).click();
  await expect(card(page)).toContainText('5 of 5 rows kept');
});

test('IMP-6: own-account transfers follow their switch and patterns', async ({ page }) => {
  const first = ownList(page).locator('.pattern-item').first();
  await expect(first.getByLabel('Text to look for')).toHaveValue('transfer to own account');
  await expect(first).toContainText('Removes 0 rows');
  await first.getByLabel('Text to look for').fill('streaming');
  await expect(first).toContainText('Removes 1 row');
  await expect(card(page)).toContainText('4 of 5 rows kept');
  await expect(card(page)).toContainText('Own-account transfers: 1 row removed');

  await page.getByLabel('Remove transfers between my own accounts').uncheck();
  await expect(card(page)).toContainText('5 of 5 rows kept');
});

test('IMP-2, IMP-6: a range that ends before it starts is explained and flagged', async ({
  page,
}) => {
  await expect(badge(page)).toHaveText('Ready');
  await page.getByLabel('First day to keep').fill('2026-03-01');
  await page.getByLabel('Last day to keep').fill('2026-02-01');
  await expect(page.locator('.field .error', { hasText: 'ends before' })).toBeVisible();
  await expect(badge(page)).toHaveText('Needs attention');
});

test('layout holds with the filtering step open', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Add an exclusion pattern' }).click();
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
