import { expect, test } from '@playwright/test';
import { PLAN, openPlanner, storedPlan } from './planner-helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const card = (page, name) => page.getByRole('article', { name });
const status = page => page.getByRole('status').filter({ hasText: /cards/ });
const handoffKey = page => page.evaluate(() => localStorage.getItem('budget-planner:handoff'));

/** Import both fixtures on the import page, pick a mode, send, and open the planner. */
async function sendFromImport(page, mode) {
  await page.goto('/import.html');
  await page.getByRole('tab', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await page.getByRole('tab', { name: /^Output/ }).click();
  await page.locator('#step-body-output').getByLabel(mode).check();
  await page.getByRole('button', { name: 'Send to planner' }).click();
  await page.getByRole('link', { name: 'Open the planner' }).click();
  await expect(page).toHaveURL(/index\.html$/);
}

test('STOR-6: cards sent from the import page appear in the planner, without a server', async ({
  page,
}) => {
  await page.goto('/import.html');
  await page.evaluate(() => localStorage.clear());
  await sendFromImport(page, 'Replace the planner’s cards');
  await expect(status(page)).toContainText('3 cards');
  await expect(card(page, 'Imported recurring')).toBeVisible();
  await expect(card(page, 'Imported · Jan 26')).toBeVisible();
  await expect(
    card(page, 'Imported recurring').getByText('Imported', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByLabel('First month')).toHaveValue('2026-01');
  // 3000 income over 2 months, 420 a month rent and 19.90 + 20 one-time: the sample statements
  await expect(page.getByRole('region', { name: 'Balance summary' })).not.toContainText(
    'Cash after 12 months: 0.00',
  );
});

test('STOR-6: the payload is used once: it is gone after the planner reads it', async ({
  page,
}) => {
  await page.goto('/import.html');
  await page.evaluate(() => localStorage.clear());
  await sendFromImport(page, 'Replace the planner’s cards');
  expect(await handoffKey(page)).toBeNull();
  const before = await storedPlan(page);
  await page.reload();
  expect(await storedPlan(page)).toEqual(before);
  await expect(status(page)).toHaveCount(0);
});

test('STOR-6: replace drops the cards that were there', async ({ page }) => {
  await openPlanner(page, PLAN);
  await sendFromImport(page, 'Replace the planner’s cards');
  await expect(card(page, 'Every month')).toHaveCount(0);
  await expect(card(page, 'Holiday')).toHaveCount(0);
  expect((await storedPlan(page)).salaryCents).toBe(250000);
});

test('STOR-6: merge keeps the cards that were there', async ({ page }) => {
  await openPlanner(page, PLAN);
  await sendFromImport(page, 'Add to the planner’s cards');
  await expect(card(page, 'Every month')).toBeVisible();
  await expect(card(page, 'Holiday')).toBeVisible();
  await expect(card(page, 'Imported recurring')).toBeVisible();
  expect((await storedPlan(page)).start).toBe('2026-01');
});

test('STOR-6: sending the same cards to merge twice does not duplicate them', async ({ page }) => {
  await openPlanner(page, null);
  await sendFromImport(page, 'Add to the planner’s cards');
  const once = (await storedPlan(page)).cards.flatMap(c => c.entries).length;
  await page.getByRole('link', { name: 'Import', exact: true }).click();
  await page.getByRole('tab', { name: /^Output/ }).click();
  await page.locator('#step-body-output').getByLabel('Add to the planner’s cards').check();
  await page.getByRole('button', { name: 'Send to planner' }).click();
  await page.getByRole('link', { name: 'Open the planner' }).click();
  expect((await storedPlan(page)).cards.flatMap(c => c.entries)).toHaveLength(once);
});

test('STOR-6: an invalid payload is discarded with a message and changes nothing', async ({
  page,
}) => {
  await openPlanner(page, PLAN);
  await page.evaluate(() =>
    localStorage.setItem(
      'budget-planner:handoff',
      JSON.stringify({
        version: 1,
        data: { mode: 'replace', months: [], cards: [{ id: 'x', type: 'weekly' }] },
      }),
    ),
  );
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'could not be used' })).toBeVisible();
  expect(await handoffKey(page)).toBeNull();
  await expect(card(page, 'Every month')).toBeVisible();
  expect(await storedPlan(page)).toEqual(PLAN);
});

test('STOR-6: a payload from a newer version is left alone and explained', async ({ page }) => {
  await openPlanner(page, PLAN);
  const future = JSON.stringify({ version: 7, data: {} });
  await page.evaluate(value => localStorage.setItem('budget-planner:handoff', value), future);
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'newer version' })).toBeVisible();
  expect(await handoffKey(page)).toBe(future);
  await expect(card(page, 'Every month')).toBeVisible();
});
