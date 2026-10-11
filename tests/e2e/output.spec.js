import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectTapTargets } from './helpers.js';

const JAN = 'tests/fixtures/comma-split.csv';
const FEB = 'tests/fixtures/missing-balance.csv';

const preview = page => page.locator('#result-output');
const body = page => page.locator('#step-body-output');

test.beforeEach(async ({ page }) => {
  await page.goto('/import.html');
  await page.getByRole('button', { name: /^Import/ }).click();
  await page.getByLabel('Statement files').setInputFiles([JAN, FEB]);
  await page.getByRole('button', { name: /^Output/ }).click();
});

test('IMP-12: the cards are previewed with totals for the whole period', async ({ page }) => {
  await expect(preview(page)).toContainText('Over 2 months');
  await expect(preview(page)).toContainText('Income 3000.00');
  await expect(preview(page)).toContainText('Expenses 859.90');
  await expect(preview(page)).toContainText('Savings 0.00');
  await expect(preview(page)).toContainText('Net 2140.10');
  const cards = preview(page).locator('.card-line');
  await expect(cards).toHaveCount(3);
  await expect(cards.filter({ hasText: 'Sample Landlord' })).toContainText('420.00 / month');
  await expect(cards.filter({ hasText: 'Demo Streaming' })).toContainText('2026-01-09');
});

test('IMP-12: the preview follows manual changes', async ({ page }) => {
  await page.getByRole('tab', { name: /^One-time/ }).click();
  const row = page.locator('#result-result .result-item', { hasText: 'Demo Streaming' });
  await row.getByRole('button', { name: 'Change Demo Streaming' }).click();
  await row.getByRole('button', { name: 'Ignore Demo Streaming' }).click();
  await expect(preview(page).locator('.card-line')).toHaveCount(2);
  await expect(preview(page)).toContainText('Expenses 840.00');
});

test('IMP-12: the mode decides what the confirmation says', async ({ page }) => {
  await expect(body(page).getByLabel('Replace the planner’s cards')).toBeChecked();
  await expect(body(page).getByRole('status')).toContainText(
    'current cards will be replaced by 2 recurring cards and 1 one-time card',
  );
  await body(page).getByLabel('Add to the planner’s cards').check();
  await expect(body(page).getByRole('status')).toContainText(
    '2 recurring cards and 1 one-time card will be added to the planner',
  );
});

test('IMP-12: the payload downloads as JSON with cards only', async ({ page }) => {
  await body(page).getByLabel('Add to the planner’s cards').check();
  const download = page.waitForEvent('download');
  await body(page).getByRole('button', { name: 'Download JSON' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('planner-cards.json');
  const payload = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(payload.version).toBe(1);
  expect(payload.data.mode).toBe('merge');
  expect(payload.data.months).toEqual(['2026-01', '2026-02']);
  expect(payload.data.cards).toHaveLength(3);
  expect(JSON.stringify(payload)).not.toContain('Paid to');
});

test('IMP-12: sending stores the payload for the planner and says so', async ({ page }) => {
  await body(page).getByRole('button', { name: 'Send to planner' }).click();
  await expect(body(page).getByRole('status')).toContainText('Cards sent');
  await expect(body(page).getByRole('link', { name: 'Open the planner' })).toHaveAttribute(
    'href',
    './index.html',
  );
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('budget-planner:handoff')),
  );
  expect(stored.version).toBe(1);
  expect(stored.data.mode).toBe('replace');
  expect(stored.data.cards).toHaveLength(3);
});

test('IMP-12: with nothing to send, the buttons are off', async ({ page }) => {
  for (const name of ['comma-split.csv', 'missing-balance.csv']) {
    await page.getByRole('button', { name: `Remove ${name}` }).click();
  }
  await expect(page.getByRole('button', { name: /^Output/ })).toBeDisabled();
});

test('layout holds with the output step open', async ({ page }, info) => {
  await expectNoHorizontalOverflow(page);
  if (info.project.name === 'mobile') await expectTapTargets(page);
});
